import Link from "next/link";
import { ArrowLeft, Package, Search } from "lucide-react";
import { getAllPublishedProducts } from "@/lib/artists";

const money = new Intl.NumberFormat("ru-RU", {
  style: "currency",
  currency: "RUB",
  maximumFractionDigits: 0
});

type CatalogPageProps = {
  searchParams: Promise<{
    q?: string;
    category?: string;
    artist?: string;
    sort?: string;
  }>;
};

export const revalidate = 60;

export default async function CatalogPage({ searchParams }: CatalogPageProps) {
  const params = await searchParams;
  const q = (params.q || "").trim().toLowerCase();
  const category = (params.category || "").trim();
  const artist = (params.artist || "").trim();
  const sort = (params.sort || "newest").trim();

  const result = await getAllPublishedProducts();
  let products = result.data;

  if (q) {
    products = products.filter(
      (p) =>
        p.title.toLowerCase().includes(q) ||
        p.artist_name.toLowerCase().includes(q) ||
        p.description.toLowerCase().includes(q)
    );
  }
  if (category) {
    products = products.filter((p) => p.category === category);
  }
  if (artist) {
    products = products.filter((p) => p.artist_slug === artist);
  }

  if (sort === "price-asc") {
    products = [...products].sort((a, b) => a.price_rub - b.price_rub);
  } else if (sort === "price-desc") {
    products = [...products].sort((a, b) => b.price_rub - a.price_rub);
  }

  const categories = Array.from(new Set(result.data.map((p) => p.category).filter(Boolean))).sort();
  const artists = Array.from(
    new Map(result.data.map((p) => [p.artist_slug, p.artist_name])).entries()
  ).sort((a, b) => a[1].localeCompare(b[1]));

  return (
    <main>
      <header className="topbar">
        <Link className="brand" href="/" aria-label="Оукцион">
          <span className="brandMark">О</span>
          <span>Оукцион</span>
        </Link>
        <nav className="nav" aria-label="Основные разделы">
          <Link href="/catalog">Каталог</Link>
          <Link href="/#services">Услуги</Link>
          <Link href="/#artists">Артисты</Link>
          <Link href="/#auction">Аукцион</Link>
          <Link href="/cabinet/artists">Продавцам</Link>
        </nav>
        <div className="headerActions">
          <Link className="primaryButton" href="/catalog">
            <Package size={17} />
            Каталог
          </Link>
        </div>
      </header>

      <section className="section catalogSection">
        <div className="sectionHead">
          <div>
            <span className="kicker">
              <Package size={15} /> каталог
            </span>
            <h1>Опубликованные товары публичных персон</h1>
          </div>
          <Link href="/">
            <ArrowLeft size={15} />
            На главную
          </Link>
        </div>

        <form className="catalogFilters" method="get">
          <label className="catalogSearch">
            <Search size={16} />
            <input name="q" defaultValue={params.q || ""} placeholder="Поиск по названию, персоне, описанию" />
          </label>
          <select name="category" defaultValue={category}>
            <option value="">Все категории</option>
            {categories.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
          <select name="artist" defaultValue={artist}>
            <option value="">Все персоны</option>
            {artists.map(([slug, name]) => (
              <option key={slug} value={slug}>{name}</option>
            ))}
          </select>
          <select name="sort" defaultValue={sort}>
            <option value="newest">Сначала новые</option>
            <option value="price-asc">Сначала дешевле</option>
            <option value="price-desc">Сначала дороже</option>
          </select>
          <button className="primaryButton" type="submit">Применить</button>
        </form>

        {result.status === "error" ? (
          <p className="emptyState">Не удалось загрузить каталог. Попробуйте обновить страницу.</p>
        ) : null}
        {result.status === "empty" || products.length === 0 ? (
          <p className="emptyState">Товаров не найдено. Попробуйте изменить фильтры.</p>
        ) : null}

        {products.length > 0 ? (
          <div className="cards productGrid">
            {products.map((product) => (
              <Link className="productCard productCardLink" key={product.id} href={`/products/${product.slug}`}>
                <div
                  className="productVisual"
                  style={product.image_url ? { backgroundImage: `url("${product.image_url}")` } : undefined}
                >
                  <span>{product.title}</span>
                </div>
                <div className="cardBody">
                  <p>{product.artist_name}</p>
                  <h3>{product.title}</h3>
                  <div className="cardFooter">
                    <strong>{money.format(product.price_rub)}</strong>
                    <span>{product.quantity > 0 ? "В наличии" : "Нет в наличии"}</span>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        ) : null}
      </section>
    </main>
  );
}
