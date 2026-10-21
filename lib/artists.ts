import { supabase } from "./supabase";
import { supabaseAdmin } from "./supabase-admin";

export type Artist = {
  auction_lots_count: number;
  bio: string;
  category: string;
  city: string | null;
  featured: boolean;
  image_url: string | null;
  name: string;
  services_count: number;
  shop_items_count: number;
  slug: string;
  sort_order: number;
  verified: boolean;
};

export type ArtistFormState = {
  message: string;
  ok: boolean;
};

export type LoadStatus = "ok" | "empty" | "error";

export type LoadResult<T> = {
  data: T;
  status: LoadStatus;
};

export type PhysicalProduct = {
  artist_name: string;
  artist_slug: string;
  category: string;
  condition: string;
  delivery: string;
  description: string;
  id: string;
  image_url: string | null;
  price_rub: number;
  provenance: string;
  quantity: number;
  slug: string;
  status: string;
  title: string;
};

export type ProductFormState = {
  message: string;
  ok: boolean;
};

function normalizeText(value: unknown) {
  return typeof value === "string" ? value : "";
}

function normalizeNumber(value: unknown) {
  const numberValue = Number(value || 0);
  return Number.isFinite(numberValue) ? numberValue : 0;
}

export async function getFeaturedArtists(): Promise<LoadResult<Artist[]>> {
  if (!supabase) {
    return { data: [], status: "error" };
  }

  try {
    const { data, error } = await supabase
      .from("artists")
      .select(
        "auction_lots_count,bio,category,city,featured,image_url,name,services_count,shop_items_count,slug,sort_order,verified"
      )
      .eq("featured", true)
      .order("sort_order", { ascending: true })
      .order("created_at", { ascending: false })
      .limit(3);

    if (error) {
      console.error("Featured artists query failed", error.message);
      return { data: [], status: "error" };
    }

    if (!data?.length) {
      return { data: [], status: "empty" };
    }

    const slugs = data.map((artist) => artist.slug);
    const { data: productCounts } = await supabase
      .from("physical_products")
      .select("artist_slug")
      .in("artist_slug", slugs);

    const counts = new Map<string, number>();
    productCounts?.forEach((product) => {
      counts.set(
        product.artist_slug,
        (counts.get(product.artist_slug) || 0) + 1
      );
    });

    return {
      data: data.map((artist) => ({
        ...artist,
        auction_lots_count: normalizeNumber(artist.auction_lots_count),
        services_count: normalizeNumber(artist.services_count),
        shop_items_count: counts.get(artist.slug) || 0,
        sort_order: normalizeNumber(artist.sort_order)
      })),
      status: "ok"
    };
  } catch (error) {
    console.error("Featured artists load failed", error);
    return { data: [], status: "error" };
  }
}

export async function getCabinetArtists(): Promise<Artist[]> {
  const client = supabaseAdmin || supabase;

  if (!client) {
    return [];
  }

  try {
    const { data, error } = await client
      .from("artists")
      .select(
        "auction_lots_count,bio,category,city,featured,image_url,name,services_count,shop_items_count,slug,sort_order,verified"
      )
      .order("sort_order", { ascending: true })
      .order("created_at", { ascending: false })
      .limit(24);

    if (error || !data?.length) {
      return [];
    }

    return data.map((artist) => ({
      ...artist,
      auction_lots_count: normalizeNumber(artist.auction_lots_count),
      services_count: normalizeNumber(artist.services_count),
      shop_items_count: normalizeNumber(artist.shop_items_count),
      sort_order: normalizeNumber(artist.sort_order)
    }));
  } catch (error) {
    console.error("Cabinet artists load failed", error);
    return [];
  }
}

export async function getCabinetProducts(): Promise<PhysicalProduct[]> {
  const client = supabaseAdmin || supabase;

  if (!client) {
    return [];
  }

  try {
    const { data, error } = await client
      .from("physical_products")
      .select(
        "artist_name,artist_slug,category,condition,delivery,description,id,image_url,price_rub,provenance,quantity,slug,status,title"
      )
      .order("created_at", { ascending: false })
      .limit(48);

    if (error || !data?.length) {
      return [];
    }

    return data.map((product) => ({
      artist_name: normalizeText(product.artist_name),
      artist_slug: normalizeText(product.artist_slug),
      category: normalizeText(product.category),
      condition: normalizeText(product.condition) || "не указано",
      delivery: normalizeText(product.delivery) || "доставка обсуждается",
      description: normalizeText(product.description),
      id: normalizeText(product.id),
      image_url: product.image_url || null,
      price_rub: normalizeNumber(product.price_rub),
      provenance: normalizeText(product.provenance),
      quantity: normalizeNumber(product.quantity),
      slug: normalizeText(product.slug),
      status: normalizeText(product.status) || "draft",
      title: normalizeText(product.title)
    }));
  } catch (error) {
    console.error("Cabinet products load failed", error);
    return [];
  }
}

export async function getPublishedProducts(): Promise<LoadResult<PhysicalProduct[]>> {
  if (!supabase) {
    return { data: [], status: "error" };
  }

  try {
    const { data, error } = await supabase
      .from("physical_products")
      .select(
        "artist_name,artist_slug,category,condition,delivery,description,id,image_url,price_rub,provenance,quantity,slug,status,title"
      )
      .eq("status", "published")
      .order("created_at", { ascending: false })
      .limit(12);

    if (error) {
      console.error("Published products query failed", error.message);
      return { data: [], status: "error" };
    }

    if (!data?.length) {
      return { data: [], status: "empty" };
    }

    return {
      data: data.map((product) => ({
        artist_name: normalizeText(product.artist_name),
        artist_slug: normalizeText(product.artist_slug),
        category: normalizeText(product.category),
        condition: normalizeText(product.condition) || "не указано",
        delivery: normalizeText(product.delivery) || "доставка обсуждается",
        description: normalizeText(product.description),
        id: normalizeText(product.id),
        image_url: product.image_url || null,
        price_rub: normalizeNumber(product.price_rub),
        provenance: normalizeText(product.provenance),
        quantity: normalizeNumber(product.quantity),
        slug: normalizeText(product.slug),
        status: normalizeText(product.status) || "draft",
        title: normalizeText(product.title)
      })),
      status: "ok"
    };
  } catch (error) {
    console.error("Published products load failed", error);
    return { data: [], status: "error" };
  }
}


export async function getAllPublishedProducts(): Promise<LoadResult<PhysicalProduct[]>> {
  if (!supabase) {
    return { data: [], status: "error" };
  }

  try {
    const { data, error } = await supabase
      .from("physical_products")
      .select(
        "artist_name,artist_slug,category,condition,delivery,description,id,image_url,price_rub,provenance,quantity,slug,status,title"
      )
      .eq("status", "published")
      .order("created_at", { ascending: false })
      .limit(200);

    if (error) {
      console.error("Published products query failed", error.message);
      return { data: [], status: "error" };
    }

    if (!data?.length) {
      return { data: [], status: "empty" };
    }

    return {
      data: data.map((product) => ({
        artist_name: normalizeText(product.artist_name),
        artist_slug: normalizeText(product.artist_slug),
        category: normalizeText(product.category),
        condition: normalizeText(product.condition) || "не указано",
        delivery: normalizeText(product.delivery) || "доставка обсуждается",
        description: normalizeText(product.description),
        id: normalizeText(product.id),
        image_url: product.image_url || null,
        price_rub: normalizeNumber(product.price_rub),
        provenance: normalizeText(product.provenance),
        quantity: normalizeNumber(product.quantity),
        slug: normalizeText(product.slug),
        status: normalizeText(product.status) || "draft",
        title: normalizeText(product.title)
      })),
      status: "ok"
    };
  } catch (error) {
    console.error("Published products load failed", error);
    return { data: [], status: "error" };
  }
}

export async function getProductBySlug(slug: string): Promise<PhysicalProduct | null> {
  const decodedSlug = (() => {
    try {
      return decodeURIComponent(slug);
    } catch {
      return slug;
    }
  })();
  if (!supabase || !decodedSlug) {
    return null;
  }

  try {
    const { data, error } = await supabase
      .from("physical_products")
      .select(
        "artist_name,artist_slug,category,condition,delivery,description,id,image_url,price_rub,provenance,quantity,slug,status,title"
      )
      .eq("slug", decodedSlug)
      .eq("status", "published")
      .maybeSingle();

    if (error || !data) {
      return null;
    }

    return {
      artist_name: normalizeText(data.artist_name),
      artist_slug: normalizeText(data.artist_slug),
      category: normalizeText(data.category),
      condition: normalizeText(data.condition) || "не указано",
      delivery: normalizeText(data.delivery) || "доставка обсуждается",
      description: normalizeText(data.description),
      id: normalizeText(data.id),
      image_url: data.image_url || null,
      price_rub: normalizeNumber(data.price_rub),
      provenance: normalizeText(data.provenance),
      quantity: normalizeNumber(data.quantity),
      slug: normalizeText(data.slug),
      status: normalizeText(data.status) || "draft",
      title: normalizeText(data.title)
    };
  } catch {
    return null;
  }
}

export async function getArtistBySlug(slug: string): Promise<Artist | null> {
  const decodedSlug = (() => {
    try {
      return decodeURIComponent(slug);
    } catch {
      return slug;
    }
  })();
  if (!supabase || !decodedSlug) {
    return null;
  }

  try {
    const { data, error } = await supabase
      .from("artists")
      .select(
        "auction_lots_count,bio,category,city,featured,image_url,name,services_count,shop_items_count,slug,sort_order,verified"
      )
      .eq("slug", decodedSlug)
      .maybeSingle();

    if (error || !data) {
      return null;
    }

    const { data: productCounts } = await supabase
      .from("physical_products")
      .select("artist_slug")
      .eq("artist_slug", slug)
      .eq("status", "published");

    return {
      ...data,
      auction_lots_count: normalizeNumber(data.auction_lots_count),
      services_count: normalizeNumber(data.services_count),
      shop_items_count: productCounts?.length || 0,
      sort_order: normalizeNumber(data.sort_order)
    };
  } catch {
    return null;
  }
}

export async function getPublishedProductsByArtistSlug(slug: string): Promise<PhysicalProduct[]> {
  const decodedSlug = (() => {
    try {
      return decodeURIComponent(slug);
    } catch {
      return slug;
    }
  })();
  if (!supabase || !decodedSlug) {
    return [];
  }

  try {
    const { data, error } = await supabase
      .from("physical_products")
      .select(
        "artist_name,artist_slug,category,condition,delivery,description,id,image_url,price_rub,provenance,quantity,slug,status,title"
      )
      .eq("artist_slug", decodedSlug)
      .eq("status", "published")
      .order("created_at", { ascending: false })
      .limit(100);

    if (error || !data?.length) {
      return [];
    }

    return data.map((product) => ({
      artist_name: normalizeText(product.artist_name),
      artist_slug: normalizeText(product.artist_slug),
      category: normalizeText(product.category),
      condition: normalizeText(product.condition) || "не указано",
      delivery: normalizeText(product.delivery) || "доставка обсуждается",
      description: normalizeText(product.description),
      id: normalizeText(product.id),
      image_url: product.image_url || null,
      price_rub: normalizeNumber(product.price_rub),
      provenance: normalizeText(product.provenance),
      quantity: normalizeNumber(product.quantity),
      slug: normalizeText(product.slug),
      status: normalizeText(product.status) || "draft",
      title: normalizeText(product.title)
    }));
  } catch {
    return [];
  }
}
