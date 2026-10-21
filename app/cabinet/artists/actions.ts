"use server";

import { cookies, headers } from "next/headers";
import { createHash } from "node:crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { ArtistFormState, ProductFormState } from "@/lib/artists";
import { supabaseAdmin } from "@/lib/supabase-admin";

const accessCookieName = "oukcion_cabinet_access";
const mediaBucketName = "oukcion-media";
const allowedImageTypes = new Set(["image/jpeg", "image/png", "image/webp"]);
const maxImageSizeMb = 4;
const maxImageSizeBytes = maxImageSizeMb * 1024 * 1024;

function getAccessCookieValue() {
  if (!process.env.CABINET_ACCESS_CODE) {
    return "";
  }

  return createHash("sha256")
    .update(`oukcion-cabinet:${process.env.CABINET_ACCESS_CODE}`)
    .digest("hex");
}

// Ограничение попыток входа в кабинет оператора.
//
// Единственный источник счётчика — общая таблица cabinet_login_attempts в
// Postgres и SECURITY DEFINER функция check_cabinet_login_rate_limit.
// Serverless-инстансы Vercel не разделят память, поэтому счётчик в памяти
// процесса не является общей защитой: параллельные запросы к разным
// инстансам его не увидят. Поэтому обходного in-memory счётчика нет — если
// общий лимитер недоступен, вход отклоняется целиком (fail closed).
const LOGIN_RATE_LIMIT_ERROR = "rate-limiter-unavailable";

async function getClientKey(): Promise<string> {
  try {
    const h = await headers();
    
    // Vercel sets x-vercel-forwarded-for as trusted header (from Vercel's proxy)
    // On Vercel, this is the real client IP and cannot be spoofed by end users
    const vercelIp = h.get("x-vercel-forwarded-for");
    if (vercelIp && process.env.VERCEL) {
      const ip = vercelIp.split(",")[0].trim();
      if (ip) return `ip:${ip}`;
    }
    
    // x-real-ip is set by some proxies (nginx)
    const realIp = h.get("x-real-ip");
    if (realIp && process.env.VERCEL) {
      return `ip:${realIp.trim()}`;
    }
    
    // Only trust x-forwarded-for on Vercel (behind trusted proxy)
    // On local/dev, use it but log warning in production would be needed
    const forwarded = h.get("x-forwarded-for");
    if (forwarded && process.env.VERCEL) {
      const ip = forwarded.split(",")[0].trim();
      if (ip) return `ip:${ip}`;
    }
    
    // Local development - still use headers but this is not production-safe
    if (process.env.NODE_ENV !== "production") {
      if (vercelIp) {
        const ip = vercelIp.split(",")[0].trim();
        if (ip) return `ip:${ip}`;
      }
      if (realIp) {
        return `ip:${realIp.trim()}`;
      }
      if (forwarded) {
        const ip = forwarded.split(",")[0].trim();
        if (ip) return `ip:${ip}`;
      }
    }
  } catch {
    // ignore
  }
  return "ip:unknown";
}

type RateLimitDecision =
  | { ok: true; allowed: boolean; remaining: number }
  | { ok: false };

// Счётчик попыток живёт только в Postgres. Если общий лимитер недоступен
// (нет service_role, RPC не применена или вернула ошибку), вход запрещается:
// ослабленный локальный счётчик не защищает общие serverless-инстансы.
async function dbCheck(key: string): Promise<RateLimitDecision> {
  if (!supabaseAdmin) {
    console.error(
      "Cabinet login rate limit unavailable: SUPABASE_SERVICE_ROLE_KEY is not configured"
    );
    return { ok: false };
  }

  const { data, error } = await supabaseAdmin.rpc("check_cabinet_login_rate_limit", {
    p_client_key: key
  });

  if (error) {
    console.error("Rate limit RPC failed, login is denied:", error.message);
    return { ok: false };
  }

  if (!Array.isArray(data) || data.length === 0) {
    console.error("Rate limit RPC returned an empty result, login is denied");
    return { ok: false };
  }

  const result = data[0] as { allowed?: unknown; remaining?: unknown } | null;

  if (
    !result ||
    typeof result.allowed !== "boolean" ||
    typeof result.remaining !== "number"
  ) {
    console.error("Rate limit RPC returned an unexpected result, login is denied");
    return { ok: false };
  }

  return { ok: true, allowed: result.allowed, remaining: result.remaining };
}

async function checkLoginRateLimit(key: string): Promise<RateLimitDecision> {
  return dbCheck(key);
}

async function resetLoginRateLimit(key: string): Promise<void> {
  if (!supabaseAdmin) {
    return;
  }

  const { error } = await supabaseAdmin.rpc("reset_cabinet_login_rate_limit", {
    p_client_key: key
  });

  if (error) {
    console.error("Rate limit reset failed:", error.message);
  }
}

function rateLimited(): never {
  redirect("/cabinet/artists?error=rate-limited");
}

function rateLimiterUnavailable(): never {
  redirect(`/cabinet/artists?error=${LOGIN_RATE_LIMIT_ERROR}`);
}


function slugify(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/ё/g, "e")
    .replace(/[^a-z0-9а-я]+/gi, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

function getString(formData: FormData, key: string) {
  return String(formData.get(key) || "").trim();
}

function getNumber(formData: FormData, key: string) {
  const value = Number.parseInt(getString(formData, key) || "0", 10);
  return Number.isFinite(value) && value >= 0 ? value : 0;
}

function getFileExtension(file: File) {
  const fromName = file.name.split(".").pop()?.toLowerCase();

  if (fromName && ["jpg", "jpeg", "png", "webp"].includes(fromName)) {
    return fromName === "jpeg" ? "jpg" : fromName;
  }

  if (file.type === "image/png") {
    return "png";
  }

  if (file.type === "image/webp") {
    return "webp";
  }

  return "jpg";
}

async function uploadImage(
  formData: FormData,
  key: string,
  folder: string,
  slug: string
) {
  if (!supabaseAdmin) {
    return {
      error: "Не настроен SUPABASE_SERVICE_ROLE_KEY для загрузки фото.",
      publicUrl: null
    };
  }

  const value = formData.get(key);

  if (!(value instanceof File) || value.size === 0) {
    return {
      error: null,
      publicUrl: null
    };
  }

  if (!allowedImageTypes.has(value.type)) {
    return {
      error: "Загрузите фото в формате JPEG, PNG или WebP.",
      publicUrl: null
    };
  }

  if (value.size > maxImageSizeBytes) {
    return {
      error: `Фото слишком большое. Максимум ${maxImageSizeMb} МБ.`,
      publicUrl: null
    };
  }

  const extension = getFileExtension(value);
  const path = `${folder}/${slug}-${Date.now()}.${extension}`;
  const { error } = await supabaseAdmin.storage
    .from(mediaBucketName)
    .upload(path, value, {
      cacheControl: "31536000",
      contentType: value.type,
      upsert: true
    });

  if (error) {
    return {
      error: `Не удалось загрузить фото: ${error.message}`,
      publicUrl: null
    };
  }

  const { data } = supabaseAdmin.storage
    .from(mediaBucketName)
    .getPublicUrl(path);

  return {
    error: null,
    publicUrl: data.publicUrl
  };
}

export async function isCabinetAllowed() {
  const cookieStore = await cookies();
  return cookieStore.get(accessCookieName)?.value === getAccessCookieValue();
}

export async function loginToCabinet(formData: FormData) {
  const clientKey = await getClientKey();
  const rate = await checkLoginRateLimit(clientKey);

  if (!rate.ok) {
    rateLimiterUnavailable();
  }

  if (!rate.allowed) {
    rateLimited();
  }

  const accessCode = getString(formData, "accessCode");

  if (!process.env.CABINET_ACCESS_CODE) {
    redirect("/cabinet/artists?error=access-not-configured");
  }

  if (accessCode !== process.env.CABINET_ACCESS_CODE) {
    redirect("/cabinet/artists?error=wrong-code");
  }

  await resetLoginRateLimit(clientKey);

  const cookieStore = await cookies();
  cookieStore.set(accessCookieName, getAccessCookieValue(), {
    httpOnly: true,
    maxAge: 60 * 60 * 12,
    path: "/",
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production"
  });

  redirect("/cabinet/artists");
}

export async function saveArtist(
  _previousState: ArtistFormState,
  formData: FormData
): Promise<ArtistFormState> {
  const allowed = await isCabinetAllowed();
  if (!allowed) {
    redirect("/cabinet/artists?error=unauthorized");
  }

  if (!(await isCabinetAllowed())) {
    return {
      message: "Сначала введите код доступа.",
      ok: false
    };
  }

  if (!supabaseAdmin) {
    return {
      message: "Не настроен SUPABASE_SERVICE_ROLE_KEY для сохранения.",
      ok: false
    };
  }

  const name = getString(formData, "name");
  const category = getString(formData, "category");
  const bio = getString(formData, "bio");
  const rawSlug = getString(formData, "slug");
  const slug = slugify(rawSlug || name);

  if (!name || !category || !bio || !slug) {
    return {
      message:
        "Заполните имя артиста, название муз. группы и описание артиста.",
      ok: false
    };
  }

  const artistImage = await uploadImage(
    formData,
    "image_file",
    "artists",
    slug
  );

  if (artistImage.error) {
    return {
      message: artistImage.error,
      ok: false
    };
  }

  const { error } = await supabaseAdmin.from("artists").upsert(
    {
      auction_lots_count: getNumber(formData, "auction_lots_count"),
      bio,
      category,
      city: getString(formData, "city") || null,
      featured: formData.get("featured") === "on",
      image_url:
        artistImage.publicUrl ||
        getString(formData, "existing_image_url") ||
        null,
      name,
      services_count: getNumber(formData, "services_count"),
      shop_items_count: 0,
      slug,
      sort_order: getNumber(formData, "sort_order") || 100,
      updated_at: new Date().toISOString(),
      verified: formData.get("verified") === "on"
    },
    {
      onConflict: "slug"
    }
  );

  if (error) {
    return {
      message: `Не удалось сохранить: ${error.message}`,
      ok: false
    };
  }

  revalidatePath("/");
  revalidatePath("/cabinet/artists");

  return {
    message: "Карточка артиста сохранена.",
    ok: true
  };
}

export async function savePhysicalProduct(
  _previousState: ProductFormState,
  formData: FormData
): Promise<ProductFormState> {
  const allowed = await isCabinetAllowed();
  if (!allowed) {
    redirect("/cabinet/artists?error=unauthorized");
  }

  try {
    if (!(await isCabinetAllowed())) {
      return {
        message: "Сначала введите код доступа.",
        ok: false
      };
    }

    if (!supabaseAdmin) {
      return {
        message: "Не настроен SUPABASE_SERVICE_ROLE_KEY для сохранения.",
        ok: false
      };
    }

    const artistValue = getString(formData, "artist");
    const [artistSlug, ...artistNameParts] = artistValue.split("|");
    const artistName = artistNameParts.join("|");
    const title = getString(formData, "title");
    const category = getString(formData, "category");
    const description = getString(formData, "description");
    const provenance = getString(formData, "provenance");
    const rawSlug = getString(formData, "slug");
    const slug = slugify(rawSlug || `${artistSlug}-${title}`);

    if (
      !artistSlug ||
      !artistName ||
      !title ||
      !category ||
      !description ||
      !provenance ||
      !slug
    ) {
      return {
        message:
          "Выберите артиста и заполните название, категорию, описание и происхождение товара.",
        ok: false
      };
    }

    const productImage = await uploadImage(
      formData,
      "image_file",
      "products",
      slug
    );

    if (productImage.error) {
      return {
        message: productImage.error,
        ok: false
      };
    }

    const { error } = await supabaseAdmin.from("physical_products").upsert(
      {
        artist_name: artistName,
        artist_slug: artistSlug,
        category,
        condition: getString(formData, "condition") || "не указано",
        delivery: getString(formData, "delivery") || "доставка обсуждается",
        description,
        image_url:
          productImage.publicUrl ||
          getString(formData, "existing_image_url") ||
          null,
        price_rub: getNumber(formData, "price_rub"),
        product_type: "physical",
        provenance,
        quantity: getNumber(formData, "quantity") || 1,
        slug,
        status: getString(formData, "status") || "draft",
        title,
        updated_at: new Date().toISOString()
      },
      {
        onConflict: "slug"
      }
    );

    if (error) {
      console.error("Physical product save failed", error);
      return {
        message: `Не удалось сохранить товар: ${error.message}`,
        ok: false
      };
    }

    revalidatePath("/");
    revalidatePath("/cabinet/artists");

    return {
      message: "Физический товар сохранён. Обновите страницу, чтобы увидеть его в списке.",
      ok: true
    };
  } catch (error) {
    console.error("Physical product save crashed", error);
    return {
      message:
        error instanceof Error
          ? `Ошибка сохранения товара: ${error.message}`
          : "Ошибка сохранения товара.",
      ok: false
    };
  }
}

export async function deleteArtist(formData: FormData) {
  const allowed = await isCabinetAllowed();
  if (!allowed) {
    redirect("/cabinet/artists?error=unauthorized");
  }

  if (!(await isCabinetAllowed())) {
    redirect("/cabinet/artists?error=not-allowed");
  }

  if (!supabaseAdmin) {
    redirect("/cabinet/artists?error=admin-not-configured");
  }

  const slug = getString(formData, "slug");

  if (!slug) {
    redirect("/cabinet/artists?error=delete-artist-failed");
  }

  const { count, error: countError } = await supabaseAdmin
    .from("physical_products")
    .select("id", { count: "exact", head: true })
    .eq("artist_slug", slug);

  if (countError) {
    redirect("/cabinet/artists?error=delete-artist-failed");
  }

  if (count && count > 0) {
    redirect("/cabinet/artists?error=artist-has-products");
  }

  const { error } = await supabaseAdmin
    .from("artists")
    .delete()
    .eq("slug", slug);

  if (error) {
    redirect("/cabinet/artists?error=delete-artist-failed");
  }

  revalidatePath("/");
  revalidatePath("/cabinet/artists");
  redirect("/cabinet/artists?deleted=artist");
}

export async function deletePhysicalProduct(formData: FormData) {
  const allowed = await isCabinetAllowed();
  if (!allowed) {
    redirect("/cabinet/artists?error=unauthorized");
  }

  if (!(await isCabinetAllowed())) {
    redirect("/cabinet/artists?error=not-allowed");
  }

  if (!supabaseAdmin) {
    redirect("/cabinet/artists?error=admin-not-configured");
  }

  const slug = getString(formData, "slug");

  if (!slug) {
    redirect("/cabinet/artists?error=delete-product-failed");
  }

  const { error } = await supabaseAdmin
    .from("physical_products")
    .delete()
    .eq("slug", slug);

  if (error) {
    redirect("/cabinet/artists?error=delete-product-failed");
  }

  revalidatePath("/");
  revalidatePath("/cabinet/artists");
  redirect("/cabinet/artists?deleted=product");
}
