"use client";

import Link from "next/link";

type CabinetErrorProps = {
  error: Error & { digest?: string };
  reset: () => void;
};

export default function CabinetArtistsError({
  error,
  reset
}: CabinetErrorProps) {
  return (
    <main className="cabinetPage">
      <section className="cabinetShell compact">
        <div className="cabinetForm">
          <p className="formStatus error">
            Кабинет не смог загрузиться. Попробуйте обновить страницу. Если
            ошибка повторится, нужно проверить последнюю сохранённую карточку
            товара.
          </p>
          {error.digest ? (
            <p className="emptyState">Код ошибки: {error.digest}</p>
          ) : null}
          <div className="formFooter">
            <button className="primaryButton" onClick={reset} type="button">
              Обновить
            </button>
            <Link className="secondaryFormButton" href="/">
              На сайт
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}
