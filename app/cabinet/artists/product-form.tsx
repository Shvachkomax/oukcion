"use client";

import { ChangeEvent, useMemo, useState, useActionState } from "react";
import { PackagePlus } from "lucide-react";
import type { Artist, PhysicalProduct, ProductFormState } from "@/lib/artists";
import { savePhysicalProduct } from "./actions";

const initialState: ProductFormState = {
  message: "",
  ok: false
};

type ProductDraft = {
  artist: string;
  category: string;
  condition: string;
  delivery: string;
  description: string;
  existing_image_url: string;
  price_rub: string;
  provenance: string;
  quantity: string;
  slug: string;
  status: string;
  title: string;
};

const emptyProduct: ProductDraft = {
  artist: "",
  category: "",
  condition: "не указано",
  delivery: "",
  description: "",
  existing_image_url: "",
  price_rub: "",
  provenance: "",
  quantity: "",
  slug: "",
  status: "draft",
  title: ""
};

type ProductFormProps = {
  artists: Artist[];
  products: PhysicalProduct[];
};

export function ProductForm({ artists, products }: ProductFormProps) {
  const [state, formAction, pending] = useActionState(
    savePhysicalProduct,
    initialState
  );
  const [draft, setDraft] = useState<ProductDraft>(emptyProduct);
  const [selectedProduct, setSelectedProduct] = useState("");

  const productsBySlug = useMemo(
    () => new Map(products.map((product) => [product.slug, product])),
    [products]
  );

  function selectProduct(event: ChangeEvent<HTMLSelectElement>) {
    const slug = event.target.value;
    setSelectedProduct(slug);

    if (!slug) {
      setDraft(emptyProduct);
      return;
    }

    const product = productsBySlug.get(slug);

    if (!product) {
      return;
    }

    setDraft({
      artist: `${product.artist_slug}|${product.artist_name}`,
      category: product.category,
      condition: product.condition,
      delivery: product.delivery,
      description: product.description,
      existing_image_url: product.image_url || "",
      price_rub: String(product.price_rub || ""),
      provenance: product.provenance,
      quantity: String(product.quantity || ""),
      slug: product.slug,
      status: product.status,
      title: product.title
    });
  }

  function updateField(key: keyof ProductDraft, value: string) {
    setDraft((current) => ({
      ...current,
      [key]: value
    }));
  }

  function resetForm() {
    setSelectedProduct("");
    setDraft(emptyProduct);
  }

  return (
    <form action={formAction} className="cabinetForm productForm">
      <label>
        Режим
        <select onChange={selectProduct} value={selectedProduct}>
          <option value="">Добавить новый товар</option>
          {products.map((product) => (
            <option key={product.slug} value={product.slug}>
              Редактировать: {product.title}
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
          Артист / владелец товара
          <select
            name="artist"
            onChange={(event) => updateField("artist", event.target.value)}
            required
            value={draft.artist}
          >
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
          <input
            name="title"
            onChange={(event) => updateField("title", event.target.value)}
            placeholder="Например: сценическая куртка"
            required
            value={draft.title}
          />
        </label>
        <label>
          Короткий адрес товара
          <input
            name="slug"
            onChange={(event) => updateField("slug", event.target.value)}
            placeholder="artist-jacket"
            value={draft.slug}
          />
        </label>
        <label>
          Категория
          <select
            name="category"
            onChange={(event) => updateField("category", event.target.value)}
            required
            value={draft.category}
          >
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
          onChange={(event) => updateField("description", event.target.value)}
          placeholder="Что это за предмет, где использовался, чем ценен."
          required
          rows={4}
          value={draft.description}
        />
      </label>

      <label>
        История / происхождение
        <textarea
          name="provenance"
          onChange={(event) => updateField("provenance", event.target.value)}
          placeholder="Кому принадлежал предмет, как подтверждается происхождение."
          required
          rows={4}
          value={draft.provenance}
        />
      </label>

      <div className="formGrid">
        <label>
          Фото товара
          <input accept="image/jpeg,image/png,image/webp" name="image_file" type="file" />
        </label>
        <label>
          Состояние
          <select
            name="condition"
            onChange={(event) => updateField("condition", event.target.value)}
            value={draft.condition}
          >
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
          <input
            min="0"
            name="price_rub"
            onChange={(event) => updateField("price_rub", event.target.value)}
            placeholder="0"
            type="number"
            value={draft.price_rub}
          />
        </label>
        <label>
          Количество
          <input
            min="0"
            name="quantity"
            onChange={(event) => updateField("quantity", event.target.value)}
            placeholder="1"
            type="number"
            value={draft.quantity}
          />
        </label>
      </div>

      <div className="formGrid">
        <label>
          Доставка / самовывоз
          <input
            name="delivery"
            onChange={(event) => updateField("delivery", event.target.value)}
            placeholder="Доставка по РФ, самовывоз, обсуждается"
            value={draft.delivery}
          />
        </label>
        <label>
          Статус
          <select
            name="status"
            onChange={(event) => updateField("status", event.target.value)}
            value={draft.status}
          >
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
          {pending ? "Сохранение" : "Сохранить товар"}
        </button>
        <button className="secondaryFormButton" onClick={resetForm} type="button">
          Новый товар
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
