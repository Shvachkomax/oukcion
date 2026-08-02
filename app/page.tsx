import {
  BadgeCheck,
  CalendarDays,
  Gavel,
  Handshake,
  PackageCheck,
  PlayCircle,
  Search,
  ShieldCheck,
  ShoppingBag,
  Sparkles,
  Star,
  UserCheck
} from "lucide-react";
import { isSupabaseConfigured } from "@/lib/supabase";

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

export default function Home() {
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
          <a href="#auction">Аукцион</a>
          <a href="#seller">Продавцам</a>
        </nav>
        <div className="headerActions">
          <button className="iconButton" aria-label="Поиск">
            <Search size={20} />
          </button>
          <button className="primaryButton">
            <UserCheck size={18} />
            Войти
          </button>
        </div>
      </header>

      <section className="hero" id="top">
        <div className="heroCopy">
          <span className="eyebrow">
            <Sparkles size={16} />
            первый рынок - Россия, расчеты в RUB
          </span>
          <h1>Вещи с историей</h1>
          <p>
            Предметы, автографы и впечатления известных людей: сценические
            костюмы, личные вещи, редкие издания, мерч и персональные обращения.
          </p>
          <div className="heroActions">
            <a className="primaryLink" href="#auction">
              <Gavel size={18} />
              Смотреть аукцион
            </a>
            <a className="secondaryLink" href="#shop">
              Открыть магазин
            </a>
          </div>
        </div>
        <div className="heroPanel" aria-label="Сводка торгов">
          <div className="liveHeader">
            <span>Live</span>
            <strong>24 активных лота</strong>
          </div>
          <div className="featureLot">
            <div className="featureArt">
              <span>premiere lot</span>
            </div>
            <div>
              <p>Текущая ставка</p>
              <strong>{money.format(420000)}</strong>
              <small>Сценический жакет, 18 ставок</small>
            </div>
          </div>
          <div className="trustStrip">
            <span>
              <ShieldCheck size={16} /> RLS включен
            </span>
            <span>
              <BadgeCheck size={16} /> проверка продавцов
            </span>
          </div>
        </div>
      </section>

      <section className="statusGrid" aria-label="Состояние платформы">
        <div>
          <span>Supabase</span>
          <strong>{isSupabaseConfigured ? "подключен" : "ожидает ключи"}</strong>
        </div>
        <div>
          <span>Валюта</span>
          <strong>RUB</strong>
        </div>
        <div>
          <span>Модерация</span>
          <strong>обязательна</strong>
        </div>
      </section>

      <section className="section shopSection" id="shop">
        <div className="sectionHead">
          <div>
            <span className="kicker">
              <ShoppingBag size={16} /> магазин
            </span>
            <h2>Магазин: мерч, носители, книги, постеры и автографы</h2>
          </div>
          <a href="#auction">Аукционные лоты</a>
        </div>
        <div className="cards productGrid">
          {shopItems.map((item) => (
            <article className="productCard" key={item.title}>
              <div className={`productVisual cinematic ${item.tone}`}>
                <span>{item.title}</span>
              </div>
              <div className="cardBody">
                <p>{item.person}</p>
                <h3>{item.title}</h3>
                <strong>{money.format(item.price)}</strong>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="section serviceBand" id="services">
        <div className="sectionHead">
          <div>
            <span className="kicker">
              <Star size={16} /> авторские услуги
            </span>
            <h2>Услуги звёзд: обращения, мероприятия, встречи и интеграции</h2>
          </div>
        </div>
        <div className="serviceGrid">
          {services.map((service) => {
            const Icon = service.icon;
            return (
              <article className="serviceItem starService" key={service.title}>
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
      </section>

      <section className="section auctionSection" id="auction">
        <div className="sectionHead">
          <div>
            <span className="kicker">
              <Gavel size={16} /> аукцион
            </span>
            <h2>Аукцион: личные вещи, костюмы, инструменты и редкие издания</h2>
          </div>
          <a href="#top">Все категории</a>
        </div>
        <div className="cards lotGrid">
          {lots.map((lot) => (
            <article className="lotCard" key={lot.title}>
              <div className={`lotVisual photoLot ${lot.tone}`}>
                <Gavel size={34} />
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
            <PackageCheck size={16} /> продавцам
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
