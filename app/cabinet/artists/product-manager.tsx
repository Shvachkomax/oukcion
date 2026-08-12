"use client";

import {
  ChangeEvent,
  useEffect,
  useMemo,
  useRef,
  useState,
  useActionState
} from "react";
import { useRouter } from "next/navigation";
import { PackagePlus } from "lucide-react";
import type { Artist, PhysicalProduct, ProductFormState } from "@/lib/artists";
import { deletePhysicalProduct, savePhysicalProduct } from "./actions";

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

const productCategoryGroups = [
  {
    label: "Товары масс-маркет",
    options: [
      "Брендированная продукция / мерч",
      "Аудио и видеоносители",
      "Печатная продукция"
    ]
  },
  {
    label: "Авторские товары",
    options: [
      "Видеопоздравление от публичной персоны",
      "Автограф на оговоренном носителе",
      "Аудио и видеоноситель с автографом"
    ]
  },
  {
    label: "Аукцион",
    options: [
      "Автограф на лимитированной авторской серии",
      "Личный предмет публичной персоны",
      "Сценический предмет одежды",
      "Личный музыкальный инструмент или оборудование",
      "Коллекционный эксклюзив",
      "Предмет из частной коллекции с верификацией"
    ]
  },
  {
    label: "Услуги",
    options: [
      "Личная встреча",
      "Онлайн-участие в мероприятии",
      "Организация мероприятия с участием артиста",
      "Рекламная акция от публичной персоны",
      "Коммерческое использование предмета авторских прав"
    ]
  }
];

type ProductManagerProps = {
  artists: Artist[];
  products: PhysicalProduct[];
};

export function ProductManager({ artists, products }: ProductManagerProps) {
  const router = useRouter();
  const [state, formAction, pending] = useActionState(
    savePhysicalProduct,
    initialState
  );
  const [draft, setDraft] = useState<ProductDraft>(emptyProduct);
  const [selectedProduct, setSelectedProduct] = useState("");
  const formRef = useRef<HTMLFormElement>(null);

  const productsBySlug = useMemo(
    () => new Map(products.map((product) => [product.slug, product])),
    [products]
  );

  useEffect(() => {
    if (state.ok) {
      router.refresh();
    }
  }, [router, state.ok, state.message]);

  function loadProduct(slug: string) {
    setSelectedProduct(slug);

    if (!slug) {
      setDraft(emptyProduct);
      formRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
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

    formRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function selectProduct(event: ChangeEvent<HTMLSelectElement>) {
    loadProduct(event.target.value);
  }

  function updateField(key: keyof ProductDraft, value: string) {
    setDraft((current) => ({
      ...current,
      [key]: value
    }));
  }

  function resetForm() {
    loadProduct("");
  }

  function formatRub(value: number | null | undefined) {
    return Number(value || 0).toLocaleString("ru-RU");
  }

  return (
    <>
      <form action={formAction} className="cabinetForm productForm" ref={formRef}>
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
              {productCategoryGroups.map((group) => (
                <optgroup key={group.label} label={group.label}>
                  {group.options.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </optgroup>
              ))}
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
            <input
              accept="image/jpeg,image/png,image/webp"
              name="image_file"
              type="file"
            />
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
          <button
            className="secondaryFormButton"
            onClick={resetForm}
            type="button"
          >
            Новый товар
          </button>
          {state.message ? (
            <p className={state.ok ? "formStatus success" : "formStatus error"}>
              {state.message}
            </p>
          ) : null}
        </div>
      </form>

      <div className="cabinetList">
        <h2>Физические товары</h2>
        {products.length > 0 ? (
          <div className="cabinetRows">
            {products.map((product) => (
              <article key={product.id}>
                <div>
                  <strong>{product.title}</strong>
                  <span>
                    {product.artist_name} · {product.status}
                  </span>
                </div>
                <p>{product.description}</p>
                <small>
                  {product.category} · {formatRub(product.price_rub)} ₽ ·{" "}
                  {Number(product.quantity || 0)} шт.
                </small>
                <div className="rowActions">
                  <button
                    className="rowActionButton"
                    onClick={() => loadProduct(product.slug)}
                    type="button"
                  >
                    Редактировать
                  </button>
                  <form action={deletePhysicalProduct}>
                    <input name="slug" type="hidden" value={product.slug} />
                    <button
                      className="rowDangerButton"
                      onClick={(event) => {
                        if (!window.confirm("Удалить физический товар?")) {
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
          <p className="emptyState">Пока нет физических товаров.</p>
        )}
      </div>
    </>
  );
}
