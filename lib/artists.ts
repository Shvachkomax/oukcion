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

export const fallbackArtists: Artist[] = [
  {
    auction_lots_count: 3,
    bio: "Музыкальный проект с витриной подписанных носителей, редких постеров и камерных онлайн-встреч.",
    category: "музыка",
    city: "Москва",
    image_url: "/lot-studio.png",
    name: "Северный свет",
    services_count: 2,
    shop_items_count: 8,
    slug: "severny-svet",
    verified: true
  },
  {
    auction_lots_count: 2,
    bio: "Актёрский профиль с проверенными предметами со съёмок, автографами и персональными обращениями.",
    category: "кино",
    city: "Санкт-Петербург",
    image_url: "/lot-costume.png",
    name: "Дмитрий Романов",
    services_count: 3,
    shop_items_count: 5,
    slug: "dmitry-romanov",
    verified: true
  },
  {
    auction_lots_count: 1,
    bio: "Авторская карточка для книг, постеров, специальных тиражей и встреч с подписчиками.",
    category: "литература",
    city: "Казань",
    image_url: "/lot-book.png",
    name: "Алина Королева",
    services_count: 1,
    shop_items_count: 6,
    slug: "alina-koroleva",
    verified: false
  }
];

export async function getFeaturedArtists(): Promise<Artist[]> {
  if (!supabase) {
    return fallbackArtists;
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
    return fallbackArtists;
  }

  return data;
}
