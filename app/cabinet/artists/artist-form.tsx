"use client";

import { ChangeEvent, useMemo, useState, useActionState } from "react";
import { Save } from "lucide-react";
import type { Artist, ArtistFormState } from "@/lib/artists";
import { saveArtist } from "./actions";

const initialState: ArtistFormState = {
  message: "",
  ok: false
};

type ArtistDraft = {
  auction_lots_count: string;
  bio: string;
  category: string;
  city: string;
  existing_image_url: string;
  featured: boolean;
  name: string;
  services_count: string;
  slug: string;
  sort_order: string;
  verified: boolean;
};

const emptyArtist: ArtistDraft = {
  auction_lots_count: "",
  bio: "",
  category: "",
  city: "",
  existing_image_url: "",
  featured: false,
  name: "",
  services_count: "",
  slug: "",
  sort_order: "",
  verified: false
};

type ArtistFormProps = {
  artists: Artist[];
};

export function ArtistForm({ artists }: ArtistFormProps) {
  const [state, formAction, pending] = useActionState(
    saveArtist,
    initialState
  );
  const [draft, setDraft] = useState<ArtistDraft>(emptyArtist);
  const [selectedSlug, setSelectedSlug] = useState("");

  const artistsBySlug = useMemo(
    () => new Map(artists.map((artist) => [artist.slug, artist])),
    [artists]
  );

  function selectArtist(event: ChangeEvent<HTMLSelectElement>) {
    const slug = event.target.value;
    setSelectedSlug(slug);

    if (!slug) {
      setDraft(emptyArtist);
      return;
    }

    const artist = artistsBySlug.get(slug);

    if (!artist) {
      return;
    }

    setDraft({
      auction_lots_count: String(artist.auction_lots_count || ""),
      bio: artist.bio,
      category: artist.category,
      city: artist.city || "",
      existing_image_url: artist.image_url || "",
      featured: artist.featured,
      name: artist.name,
      services_count: String(artist.services_count || ""),
      slug: artist.slug,
      sort_order: String(artist.sort_order || ""),
      verified: artist.verified
    });
  }

  function updateField(
    key: keyof ArtistDraft,
    value: string | boolean
  ) {
    setDraft((current) => ({
      ...current,
      [key]: value
    }));
  }

  function resetForm() {
    setSelectedSlug("");
    setDraft(emptyArtist);
  }

  return (
    <form action={formAction} className="cabinetForm">
      <label>
        Режим
        <select onChange={selectArtist} value={selectedSlug}>
          <option value="">Создать новую карточку</option>
          {artists.map((artist) => (
            <option key={artist.slug} value={artist.slug}>
              Редактировать: {artist.name}
            </option>
          ))}
        </select>
      </label>

      <input name="existing_image_url" type="hidden" value={draft.existing_image_url} />

      <div className="formGrid">
        <label>
          Имя артиста
          <input
            name="name"
            onChange={(event) => updateField("name", event.target.value)}
            placeholder="Например: Имя артиста"
            required
            value={draft.name}
          />
        </label>
        <label>
          Сценическое имя
          <input
            name="slug"
            onChange={(event) => updateField("slug", event.target.value)}
            placeholder="artist-name"
            value={draft.slug}
          />
        </label>
        <label>
          Название муз. группы
          <input
            name="category"
            onChange={(event) => updateField("category", event.target.value)}
            placeholder="Название группы"
            required
            value={draft.category}
          />
        </label>
        <label>
          Город
          <input
            name="city"
            onChange={(event) => updateField("city", event.target.value)}
            placeholder="Москва"
            value={draft.city}
          />
        </label>
      </div>

      <label>
        Описание артиста
        <textarea
          name="bio"
          onChange={(event) => updateField("bio", event.target.value)}
          placeholder="Расскажите об артисте, творческом пути, аудитории и формате участия в проекте."
          required
          rows={5}
          value={draft.bio}
        />
      </label>

      <label>
        Фото / обложка
        <input accept="image/jpeg,image/png,image/webp" name="image_file" type="file" />
      </label>

      <div className="formGrid counters">
        <label>
          Лоты
          <input
            min="0"
            name="auction_lots_count"
            onChange={(event) =>
              updateField("auction_lots_count", event.target.value)
            }
            type="number"
            value={draft.auction_lots_count}
          />
        </label>
        <label>
          Услуги
          <input
            min="0"
            name="services_count"
            onChange={(event) =>
              updateField("services_count", event.target.value)
            }
            type="number"
            value={draft.services_count}
          />
        </label>
        <label>
          Порядок
          <input
            min="0"
            name="sort_order"
            onChange={(event) => updateField("sort_order", event.target.value)}
            placeholder="100"
            type="number"
            value={draft.sort_order}
          />
        </label>
      </div>

      <div className="toggleRow">
        <label>
          <input
            checked={draft.verified}
            name="verified"
            onChange={(event) => updateField("verified", event.target.checked)}
            type="checkbox"
          />
          Проверен
        </label>
        <label>
          <input
            checked={draft.featured}
            name="featured"
            onChange={(event) => updateField("featured", event.target.checked)}
            type="checkbox"
          />
          Показывать на главной
        </label>
      </div>

      <div className="formFooter">
        <button className="primaryButton" disabled={pending} type="submit">
          <Save size={17} />
          {pending ? "Сохранение" : "Сохранить карточку"}
        </button>
        <button className="secondaryFormButton" onClick={resetForm} type="button">
          Новая карточка
        </button>
        {state.message ? (
          <p className={state.ok ? "formStatus success" : "formStatus error"}>
            {state.message}
          </p>
        ) : null}
      </div>
    </form>
  );
}
