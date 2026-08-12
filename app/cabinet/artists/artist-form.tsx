"use client";

import { useActionState } from "react";
import { Save } from "lucide-react";
import type { ArtistFormState } from "@/lib/artists";
import { saveArtist } from "./actions";

const initialState: ArtistFormState = {
  message: "",
  ok: false
};

export function ArtistForm() {
  const [state, formAction, pending] = useActionState(
    saveArtist,
    initialState
  );

  return (
    <form action={formAction} className="cabinetForm">
      <div className="formGrid">
        <label>
          Имя артиста
          <input name="name" placeholder="Например: Имя артиста" required />
        </label>
        <label>
          Сценическое имя
          <input name="slug" placeholder="artist-name" />
        </label>
        <label>
          Название муз. группы
          <input name="category" placeholder="Название группы" required />
        </label>
        <label>
          Город
          <input name="city" placeholder="Москва" />
        </label>
      </div>

      <label>
        Описание артиста
        <textarea
          name="bio"
          placeholder="Расскажите об артисте, творческом пути, аудитории и формате участия в проекте."
          required
          rows={5}
        />
      </label>

      <label>
        Фото / обложка
        <input accept="image/jpeg,image/png,image/webp" name="image_file" type="file" />
      </label>

      <div className="formGrid counters">
        <label>
          Лоты
          <input min="0" name="auction_lots_count" type="number" />
        </label>
        <label>
          Услуги
          <input min="0" name="services_count" type="number" />
        </label>
        <label>
          Порядок
          <input min="0" name="sort_order" placeholder="100" type="number" />
        </label>
      </div>

      <div className="toggleRow">
        <label>
          <input name="verified" type="checkbox" />
          Проверен
        </label>
        <label>
          <input name="featured" type="checkbox" />
          Показывать на главной
        </label>
      </div>

      <div className="formFooter">
        <button className="primaryButton" disabled={pending} type="submit">
          <Save size={17} />
          {pending ? "Сохранение" : "Сохранить карточку"}
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
