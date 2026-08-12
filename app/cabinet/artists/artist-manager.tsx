"use client";

import { ChangeEvent, useMemo, useRef, useState, useActionState } from "react";
import { Save } from "lucide-react";
import type { Artist, ArtistFormState } from "@/lib/artists";
import { deleteArtist, saveArtist } from "./actions";

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

type ArtistManagerProps = {
  artists: Artist[];
};

export function ArtistManager({ artists }: ArtistManagerProps) {
  const [state, formAction, pending] = useActionState(
    saveArtist,
    initialState
  );
  const [draft, setDraft] = useState<ArtistDraft>(emptyArtist);
  const [selectedSlug, setSelectedSlug] = useState("");
  const formRef = useRef<HTMLFormElement>(null);

  const artistsBySlug = useMemo(
    () => new Map(artists.map((artist) => [artist.slug, artist])),
    [artists]
  );

  function loadArtist(slug: string) {
    setSelectedSlug(slug);

    if (!slug) {
      setDraft(emptyArtist);
      formRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
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

    formRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function selectArtist(event: ChangeEvent<HTMLSelectElement>) {
    loadArtist(event.target.value);
  }

  function updateField(key: keyof ArtistDraft, value: string | boolean) {
    setDraft((current) => ({
      ...current,
      [key]: value
    }));
  }

  function resetForm() {
    loadArtist("");
  }

  return (
    <>
      <form action={formAction} className="cabinetForm" ref={formRef}>
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

        <input
          name="existing_image_url"
          type="hidden"
          value={draft.existing_image_url}
        />

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
          <input
            accept="image/jpeg,image/png,image/webp"
            name="image_file"
            type="file"
          />
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
              onChange={(event) =>
                updateField("sort_order", event.target.value)
              }
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
              onChange={(event) =>
                updateField("verified", event.target.checked)
              }
              type="checkbox"
            />
            Проверен
          </label>
          <label>
            <input
              checked={draft.featured}
              name="featured"
              onChange={(event) =>
                updateField("featured", event.target.checked)
              }
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
          <button
            className="secondaryFormButton"
            onClick={resetForm}
            type="button"
          >
            Новая карточка
          </button>
          {state.message ? (
            <p className={state.ok ? "formStatus success" : "formStatus error"}>
              {state.message}
            </p>
          ) : null}
        </div>
      </form>

      <div className="cabinetList">
        <h2>Сохранённые карточки</h2>
        {artists.length > 0 ? (
          <div className="cabinetRows">
            {artists.map((artist) => (
              <article key={artist.slug}>
                <div>
                  <strong>{artist.name}</strong>
                  <span>
                    {artist.category}
                    {artist.city ? `, ${artist.city}` : ""}
                  </span>
                </div>
                <p>{artist.bio}</p>
                <small>
                  {artist.shop_items_count} товаров ·{" "}
                  {artist.auction_lots_count} лотов · {artist.services_count}{" "}
                  услуг
                </small>
                <div className="rowActions">
                  <button
                    className="rowActionButton"
                    onClick={() => loadArtist(artist.slug)}
                    type="button"
                  >
                    Редактировать
                  </button>
                  <form action={deleteArtist}>
                    <input name="slug" type="hidden" value={artist.slug} />
                    <button
                      className="rowDangerButton"
                      onClick={(event) => {
                        if (
                          !window.confirm(
                            "Удалить карточку артиста? Если у артиста есть товары, сначала нужно удалить их."
                          )
                        ) {
                          event.preventDefault();
                        }
                      }}
                      type="submit"
                    >
                      Удалить
                    </button>
                  </form>
                </div>
              </article>
            ))}
          </div>
        ) : (
          <p className="emptyState">Пока нет сохранённых карточек.</p>
        )}
      </div>
    </>
  );
}
