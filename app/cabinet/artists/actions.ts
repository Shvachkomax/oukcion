"use server";

import { cookies } from "next/headers";
import { createHash } from "node:crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { ArtistFormState, ProductFormState } from "@/lib/artists";
import { supabaseAdmin } from "@/lib/supabase-admin";

const accessCookieName = "oukcion_cabinet_access";

function getAccessCookieValue() {
  if (!process.env.CABINET_ACCESS_CODE) {
    return "";
  }

  return createHash("sha256")
    .update(`oukcion-cabinet:${process.env.CABINET_ACCESS_CODE}`)
    .digest("hex");
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

export async function isCabinetAllowed() {
  const cookieStore = await cookies();
  return cookieStore.get(accessCookieName)?.value === getAccessCookieValue();
}

export async function loginToCabinet(formData: FormData) {
  const accessCode = getString(formData, "accessCode");

  if (!process.env.CABINET_ACCESS_CODE) {
    redirect("/cabinet/artists?error=access-not-configured");
  }

  if (accessCode !== process.env.CABINET_ACCESS_CODE) {
    redirect("/cabinet/artists?error=wrong-code");
  }

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

  const { error } = await supabaseAdmin.from("artists").upsert(
    {
      auction_lots_count: getNumber(formData, "auction_lots_count"),
      bio,
      category,
      city: getString(formData, "city") || null,
      featured: formData.get("featured") === "on",
      image_url: getString(formData, "image_url") || null,
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

  const { error } = await supabaseAdmin.from("physical_products").upsert(
    {
      artist_name: artistName,
      artist_slug: artistSlug,
      category,
      condition: getString(formData, "condition") || "не указано",
      delivery: getString(formData, "delivery") || "доставка обсуждается",
      description,
      image_url: getString(formData, "image_url") || null,
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
    return {
      message: `Не удалось сохранить товар: ${error.message}`,
      ok: false
    };
  }

  revalidatePath("/");
  revalidatePath("/cabinet/artists");

  return {
    message: "Физический товар сохранён.",
    ok: true
  };
}
