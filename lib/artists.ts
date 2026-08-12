import { supabase } from "./supabase";

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

  return data;
}

export async function getCabinetArtists(): Promise<Artist[]> {
  if (!supabase) {
    return [];
  }

  const { data, error } = await supabase
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
