import { supabase } from "./supabase";
import { supabaseAdmin } from "./supabase-admin";

export type Artist = {
  auction_lots_count: number;
  bio: string;
  category: string;
  city: string | null;
  image_url: string | null;
  name: string;
  services_count: number;
  shop_items_count: number;
  slug: string;
  verified: boolean;
};

export type ArtistFormState = {
  message: string;
  ok: boolean;
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

export async function getFeaturedArtists(): Promise<Artist[]> {
  if (!supabase) {
    return [];
  }

  const { data, error } = await supabase
    .from("artists")
    .select(
      "auction_lots_count,bio,category,city,image_url,name,services_count,shop_items_count,slug,verified"
    )
    .eq("featured", true)
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: false })
    .limit(3);

  if (error || !data?.length) {
    return [];
  }

  const slugs = data.map((artist) => artist.slug);
  const { data: productCounts } = await supabase
    .from("physical_products")
    .select("artist_slug")
    .in("artist_slug", slugs);

  const counts = new Map<string, number>();
  productCounts?.forEach((product) => {
    counts.set(product.artist_slug, (counts.get(product.artist_slug) || 0) + 1);
  });

  return data.map((artist) => ({
    ...artist,
    shop_items_count: counts.get(artist.slug) || 0
  }));
}

export async function getCabinetArtists(): Promise<Artist[]> {
  const client = supabaseAdmin || supabase;

  if (!client) {
    return [];
  }

  const { data, error } = await client
    .from("artists")
    .select(
      "auction_lots_count,bio,category,city,image_url,name,services_count,shop_items_count,slug,verified"
    )
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: false })
    .limit(24);

  if (error || !data?.length) {
    return [];
  }

  return data;
}

export async function getCabinetProducts(): Promise<PhysicalProduct[]> {
  const client = supabaseAdmin || supabase;

  if (!client) {
    return [];
  }

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

  return data;
}
