import {
  ArrowRight,
  BadgeCheck,
  CalendarDays,
  Gavel,
  Handshake,
  PackageCheck,
  PlayCircle,
  Search,
  ShieldCheck,
  ShoppingBag,
  Star,
  UserCheck
} from "lucide-react";
import { getFeaturedArtists, getPublishedProducts } from "@/lib/artists";

const money = new Intl.NumberFormat("ru-RU", {
  style: "currency",
  currency: "RUB",
  maximumFractionDigits: 0
});

const shopItems = [
  {
    title: "Винил с автографом",
    person: "группа Северный свет",
    price: 18500,
    tone: "emerald"
  },
  {
    title: "Постер тура 2024",
    person: "Алина Королева",
    price: 7200,
    tone: "amber"
  },
  {
    title: "Индивидуальный автограф",
    person: "Дмитрий Романов",
    price: 12000,
    tone: "rose"
  }
];

const services = [
  {
    title: "Видеообращение",
    detail: "Поздравление до 90 секунд",
    price: 35000,
    icon: PlayCircle
  },
  {
    title: "Онлайн-встреча",
    detail: "Закрытый эфир до 45 минут",
    price: 140000,
    icon: CalendarDays
  },
  {
    title: "Рекламная интеграция",
    detail: "Бриф, согласование, публикация",
    price: 280000,
    icon: Handshake
  }
];

const lots = [
  {
    title: "Сценический жакет",
    person: "из тура «Город огней»",
    bid: 420000,
    bids: 18,
    ends: "02:14:33",
    tone: "ink"
  },
  {
    title: "Студийный микрофон",
    person: "запись альбома 2019",
    bid: 310000,
    bids: 11,
    ends: "05:48:10",
    tone: "blue"
  },
  {
    title: "Подписанная книга",
    person: "первый тираж",
    bid: 94000,
    bids: 24,
    ends: "11:02:04",
    tone: "violet"
  }
];

const sellerSteps = [
  "Заявка публичной персоны или представителя",
  "Проверка документов и полномочий",
  "Модерация товаров, услуг и провенанса",
  "Публикация после одобрения"
];

export const revalidate = 60;

export default async function Home() {
  const [artistsResult, productsResult] = await Promise.all([
    getFeaturedArtists(),
    getPublishedProducts()
  ]);

  const artists = artistsResult.data;
  const publishedProducts = productsResult.data;
  const loadStatus =
    artistsResult.status === "error" || productsResult.status === "error"
      ? "error"
      : artists.length === 0 && publishedProducts.length === 0
        ? "empty"
        : "ok";

  return (
    <main>
      <header className="topbar">
        <a className="brand" href="#top" aria-label="Оукцион">
          <span className="brandMark">О</span>
          <span>Оукцион</span>
        </a>
        <nav className="nav" aria-label="Основные разделы">
          <a href="#shop">Магазин</a>
          <a href="#services">Услуги</a>
          {artists.length > 0 ? <a href="#artists">Артисты</a> : null}
          <a href="#auction">Аукцион</a>
          <a href="/cabinet/artists">Продавцам</a>
        </nav>
        <div className="headerActions">
          <button className="iconButton" aria-label="Поиск (скоро)" title="Поиск появится позже" disabled>
            <Search size={18} />
          </button>
          <a className="primaryButton" href="/cabinet/artists">
            <UserCheck size={17} />
            Войти
          </a>
        </div>
      </header>

      <section className="hero" id="top">
        <div className="heroCopy">
          <span className="eyebrow">
            <span>RUB</span>
            первый рынок - Россия
          </span>
          <h1>Вещи, автографы и впечатления публичных людей</h1>
          <p>
            Проверенные лоты, мерч и авторские услуги в одной аккуратной
            витрине: без шума маркетплейса. История и публикация предметов описываются в карточке.
          </p>
          <div className="heroActions">
            <a className="primaryLink" href="#auction">
              Смотреть аукцион
              <ArrowRight size={17} />
            </a>
            <a className="secondaryLink" href="#shop">
              Открыть магазин
            </a>
          </div>
        </div>

        <aside className="heroPanel" aria-label="Сводка торгов">
          <div className="heroPanelLabel">аукцион дня</div>
          <div className="liveHeader">
            <span>Аукцион</span>
            <strong>Торги в разработке</strong>
          </div>
          <div className="featureLot">
            <div className="featureArt">
              <span>демонстрационный блок</span>
            </div>
            <div className="featureCopy">
              <p>Статус</p>
              <strong>Скоро</strong>
              <small>Аукционный модуль будет подключён позже</small>
            </div>
          </div>
          <div className="trustStrip">
            <span>
              <ShieldCheck size={15} /> безопасные торги
            </span>
            <span>
              <BadgeCheck size={15} /> проверка продавцов
            </span>
          </div>
        </aside>
      </section>

      {loadStatus === "error" ? (
        <section className="section" aria-live="polite">
          <div className="sectionHead">
            <div>
              <span className="kicker">Витрина</span>
              <h2>Не удалось загрузить данные</h2>
            </div>
          </div>
          <p className="emptyState">
            Сейчас не получается получить список публикаций. Попробуйте обновить
            страницу чуть позже.
          </p>
        </section>
      ) : null}

      {loadStatus === "empty" ? (
        <section className="section" aria-live="polite">
          <div className="sectionHead">
            <div>
              <span className="kicker">Витрина</span>
              <h2>Пока нет публикаций</h2>
            </div>
          </div>
          <p className="emptyState">
            Подключение к базе работает, но опубликованных артистов и товаров
            пока нет. Первые позиции появятся здесь после заполнения кабинета.
          </p>
        </section>
      ) : null}

      <section className="statusGrid" aria-label="Ключевая информация">
        <div>
          <span>Проверка продавцов</span>
          <strong>Документы и полномочия</strong>
          <p>Лоты появляются после подтверждения представителя и модерации.</p>
        </div>
        <div>
          <span>Валюта торгов</span>
          <strong>RUB</strong>
          <p>Первый рынок платформы работает в рублях.</p>
        </div>
        <div>
          <span>Модерация</span>
          <strong>планируется</strong>
          <p>Процесс модерации настраивается. Сейчас карточки публикуются через кабинет оператора.</p>
        </div>
      </section>

      {artists.length > 0 ? (
        <section className="section artistsSection" id="artists">
          <div className="sectionHead">
            <div>
              <span className="kicker">
                <BadgeCheck size={15} /> публичные персоны
              </span>
              <h2>Карточка артиста собирает доверие, товары и услуги</h2>
            </div>
            <a href="/cabinet/artists">
              Вход для оператора
              <ArrowRight size={15} />
            </a>
          </div>
          <div className="artistGrid">
            {artists.map((artist) => (
              <article className="artistCard" key={artist.slug}>
                <div
                  className="artistPortrait"
                  style={{
                    backgroundImage: `url("${
                      artist.image_url || "/cinematic-hero.png"
                    }")`
                  }}
                >
                  <span>{artist.verified ? "проверен" : "на модерации"}</span>
                </div>
                <div className="artistBody">
                  <div className="artistMeta">
                    <span>{artist.category}</span>
                    {artist.city ? <span>{artist.city}</span> : null}
                  </div>
                  <h3>{artist.name}</h3>
                  <p>{artist.bio}</p>
                  <div className="artistStats">
                    <span>
                      <strong>{artist.shop_items_count}</strong>
                      товаров
                    </span>
                    <span>
                      <strong>{artist.auction_lots_count}</strong>
                      лотов
                    </span>
                    <span>
                      <strong>{artist.services_count}</strong>
                      услуг
                    </span>
                  </div>
                </div>
              </article>
            ))}
          </div>
          {publishedProducts.length > 0 ? (
            <div className="artistProducts">
              <div className="artistProductsHead">
                <span>товары артистов</span>
                <h3>Опубликованные позиции</h3>
              </div>
              <div className="artistProductGrid">
                {publishedProducts.map((product) => (
                  <article className="artistProductCard" key={product.id}>
                    <div
                      className="artistProductImage"
                      style={{
                        backgroundImage: `url("${
                          product.image_url || "/lot-costume.png"
                        }")`
                      }}
                    >
                      <span>{product.category}</span>
                    </div>
                    <div className="artistProductBody">
                      <p>{product.artist_name}</p>
                      <h4>{product.title}</h4>
                      <div className="cardFooter">
                        <strong>{money.format(product.price_rub)}</strong>
                        <span>{product.quantity} шт.</span>
                      </div>
                    </div>
                  </article>
                ))}
              </div>
            </div>
          ) : null}
        </section>
      ) : null}

      <section className="section shopSection" id="shop">
        <div className="sectionHead">
          <div>
            <span className="kicker">
              <ShoppingBag size={15} /> магазин
            </span>
            <h2>Мерч, носители, книги, постеры и автографы</h2>
          </div>
          <a href="#auction">
            Аукционные лоты
            <ArrowRight size={15} />
          </a>
        </div>
        <p className="demoNotice">
          <span className="demoBadge">демо</span>
          Пример оформления витрины. Реальные позиции появляются из кабинета
          продавца и помечены как опубликованные.
        </p>
        <div className="cards productGrid">
          {shopItems.map((item) => (
            <article className="productCard" key={item.title}>
              <div className={`productVisual ${item.tone}`}>
                <span>{item.title}</span>
              </div>
              <div className="cardBody">
                <p>{item.person}</p>
                <h3>{item.title}</h3>
                <div className="cardFooter">
                  <strong>{money.format(item.price)}</strong>
                  <span>В наличии</span>
                </div>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="section serviceBand" id="services">
        <div className="darkFeature">
          <div>
            <span className="kicker inverted">
              <Star size={15} /> авторские услуги
            </span>
            <h2>Обращения, мероприятия, встречи и интеграции</h2>
          </div>
          <div className="serviceGrid">
            {services.map((service) => {
              const Icon = service.icon;
              return (
                <article className="serviceItem" key={service.title}>
                  <Icon size={22} />
                  <div>
                    <h3>{service.title}</h3>
                    <p>{service.detail}</p>
                  </div>
                  <strong>от {money.format(service.price)}</strong>
                </article>
              );
            })}
          </div>
          <p className="demoNotice inverted">
            <span className="demoBadge">демо</span>
            Примеры формата услуг и ориентировочные цены. Продажа услуг
            включается вместе с публикацией карточек.
          </p>
        </div>
      </section>

      <section className="section auctionSection" id="auction">
        <div className="sectionHead">
          <div>
            <span className="kicker">
              <Gavel size={15} /> аукцион
            </span>
            <h2>Личные вещи, костюмы, инструменты и редкие издания</h2>
          </div>
          <a href="#top">
            Все категории
            <ArrowRight size={15} />
          </a>
        </div>
        <p className="demoNotice">
          <span className="demoBadge">демо</span>
          Аукционный модуль в разработке. Ниже — макет карточки лота; ставки и
          таймеры пока не работают и не являются реальными торгами.
        </p>
        <div className="cards lotGrid">
          {lots.map((lot) => (
            <article className="lotCard" key={lot.title}>
              <div className={`lotVisual ${lot.tone}`}>
                <span>лот</span>
              </div>
              <div className="cardBody">
                <p>{lot.person}</p>
                <h3>{lot.title}</h3>
                <dl>
                  <div>
                    <dt>Ставка</dt>
                    <dd>{money.format(lot.bid)}</dd>
                  </div>
                  <div>
                    <dt>Ставок</dt>
                    <dd>{lot.bids}</dd>
                  </div>
                  <div>
                    <dt>До конца</dt>
                    <dd>{lot.ends}</dd>
                  </div>
                </dl>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="sellerSection" id="seller">
        <div className="sellerCopy">
          <span className="kicker">
            <PackageCheck size={15} /> продавцам
          </span>
          <h2>Заявка продавца проходит проверку и модерацию</h2>
          <p>
            Продавцом может быть публичная персона или ее представитель. Перед
            публикацией проверяются полномочия, описание лотов, документы
            происхождения и условия исполнения услуги.
          </p>
        </div>
        <ol className="steps">
          {sellerSteps.map((step) => (
            <li key={step}>{step}</li>
          ))}
        </ol>
      </section>
    </main>
  );
}
