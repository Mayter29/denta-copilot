'use client';
import { ArrowUpRight, CalendarClock, CalendarX2, Sparkles, UserRoundSearch } from 'lucide-react';
import { briefingActions, type DailyInsights } from '@/lib/domain/insights';

const icons: Record<string, typeof CalendarClock> = {
  unconfirmed: CalendarClock,
  noshow: CalendarX2,
  slots: Sparkles,
  followup: UserRoundSearch,
};

export function BriefingCards({
  insights,
  doctors,
  services,
  onAction,
  disabled,
}: {
  insights: DailyInsights | null | undefined;
  doctors: { id: string; name: string }[];
  services: { id: string; name: string }[];
  onAction: (prompt: string) => void;
  disabled?: boolean;
}) {
  if (!insights) return null;
  const names = {
    doctors: new Map(doctors.map((d) => [d.id, d.name])),
    services: new Map(services.map((s) => [s.id, s.name])),
  };
  const cards = briefingActions(insights, names);
  return (
    <div className="briefing" aria-label="Resumen proactivo del día">
      <p className="briefing-kicker">
        <Sparkles size={14} />
        Buenos días · {insights.today}
      </p>
      <div className="briefing-grid">
        {cards.map((card) => {
          const Icon = icons[card.key] ?? CalendarClock;
          return (
            <article key={card.key} className="briefing-card">
              <Icon size={19} aria-hidden="true" />
              <div>
                <strong>{card.title}</strong>
                <p>{card.detail}</p>
                <button
                  type="button"
                  className="briefing-action"
                  disabled={disabled}
                  onClick={() => onAction(card.prompt)}
                >
                  Preparar con Denta
                  <ArrowUpRight size={14} />
                </button>
              </div>
            </article>
          );
        })}
      </div>
    </div>
  );
}
