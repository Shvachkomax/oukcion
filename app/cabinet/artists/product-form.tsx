"use client";

import { useActionState } from "react";
import { PackagePlus } from "lucide-react";
import type { Artist, ProductFormState } from "@/lib/artists";
import { savePhysicalProduct } from "./actions";

const initialState: ProductFormState = {
  message: "",
  ok: false
};

type ProductFormProps = {
  artists: Artist[];
};

export function ProductForm({ artists }: ProductFormProps) {
  const [state, formAction, pending] = useActionState(
    savePhysicalProduct,
    initialState
  );

  return (
    <form action={formAction} className="cabinetForm productForm">
      <div className="formGrid">
        <label>
          Артист / владелец товара
          <select name="artist" required>
            <option value="">Выберите артиста</option>
            {artists.map((artist) => (
              <option key={artist.slug} value={`${artist.slug}|${artist.name}`}>
                {artist.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          Название товара
          <input name="title" placeholder="Например: сценическая куртка" required />
        </label>
        <label>
          Короткий адрес товара
          <input name="slug" placeholder="artist-jacket" />
        </label>
        <label>
          Категория
          <select name="category" required>
            <option value="">Выберите категорию</option>
            <option value="одежда">Одежда</option>
            <option value="автограф">Автограф</option>
            <option value="носитель">Носитель</option>
            <option value="книга">Книга</option>
            <option value="постер">Постер</option>
            <option value="аксессуар">Аксессуар</option>
            <option value="другое">Другое</option>
          </select>
        </label>
      </div>

      <label>
        Описание товара
        <textarea
          name="description"
          placeholder="Что это за предмет, где использовался, чем ценен."
          required
          rows={4}
        />
      </label>

      <label>
        История / происхождение
        <textarea
          name="provenance"
          placeholder="Кому принадлежал предмет, как подтверждается происхождение."
          required
          rows={4}
        />
      </label>

      <div className="formGrid">
        <label>
          Фото товара
          <input accept="image/jpeg,image/png,image/webp" name="image_file" type="file" />
        </label>
        <label>
          Состояние
          <select name="condition">
            <option value="не указано">Не указано</option>
            <option value="новое">Новое</option>
            <option value="отличное">Отличное</option>
            <option value="хорошее">Хорошее</option>
            <option value="есть следы использования">
              Есть следы использования
            </option>
          </select>
        </label>
        <label>
          Цена, RUB
          <input min="0" name="price_rub" placeholder="0" type="number" />
        </label>
        <label>
          Количество
          <input min="0" name="quantity" placeholder="1" type="number" />
        </label>
      </div>

      <div className="formGrid">
        <label>
          Доставка / самовывоз
          <input
            name="delivery"
            placeholder="Доставка по РФ, самовывоз, обсуждается"
          />
        </label>
        <label>
          Статус
          <select name="status">
            <option value="draft">Черновик</option>
            <option value="moderation">На модерации</option>
            <option value="published">Опубликован</option>
          </select>
        </label>
      </div>

      <div className="formFooter">
        <button
          className="primaryButton"
          disabled={pending || artists.length === 0}
          type="submit"
        >
          <PackagePlus size={17} />
          {pending ? "Сохранение" : "Добавить физический товар"}
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
