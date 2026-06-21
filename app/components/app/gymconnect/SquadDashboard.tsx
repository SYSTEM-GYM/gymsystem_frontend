"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeftIcon,
  UsersIcon,
  ClipboardDocumentIcon,
  CheckIcon,
  ArrowRightStartOnRectangleIcon,
} from "@heroicons/react/24/outline";
import {
  TrophyIcon,
  FireIcon,
  BoltIcon,
} from "@heroicons/react/24/solid";
import type { SquadDetail, SquadMember, FeedEntry } from "@/app/app/gymconnect-actions";
import { leaveSquad } from "@/app/app/gymconnect-actions";

// ── Helpers ───────────────────────────────────────────────────────────────────

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return "agora";
  if (minutes < 60) return `há ${minutes} min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `há ${hours}h`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `há ${days}d`;
  return new Date(iso).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
}

function displayName(m: Pick<SquadMember, "first_name" | "full_name">): string {
  return m.first_name ?? m.full_name?.split(" ")[0] ?? "Aluno";
}

// ── Avatar ────────────────────────────────────────────────────────────────────

function Avatar({
  photo_url,
  name,
  size = "md",
}: {
  photo_url: string | null;
  name: string;
  size?: "sm" | "md" | "lg";
}) {
  const sizes = { sm: "w-7 h-7 text-[9px]", md: "w-9 h-9 text-xs", lg: "w-11 h-11 text-sm" };
  const cls = sizes[size];

  if (photo_url) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img src={photo_url} alt={name} className={`${cls} rounded-xl object-cover flex-shrink-0`} />
    );
  }

  const init = name
    .trim()
    .split(" ")
    .slice(0, 2)
    .map((p) => p[0])
    .join("")
    .toUpperCase();

  return (
    <div className={`${cls} rounded-xl bg-primary/15 flex items-center justify-center font-black text-primary flex-shrink-0`}>
      {init}
    </div>
  );
}

// ── Ranking Tab ───────────────────────────────────────────────────────────────

type RankingPeriod = "week" | "month";

function RankingTab({ members }: { members: SquadMember[] }) {
  const [period, setPeriod] = useState<RankingPeriod>("week");

  const sorted = [...members].sort((a, b) => {
    const key = period === "week" ? "workouts_this_week" : "workouts_this_month";
    return b[key] - a[key];
  });

  const medalColors = ["text-yellow-400", "text-zinc-400", "text-amber-600"];
  const medalBg = ["bg-yellow-400/10", "bg-zinc-400/10", "bg-amber-600/10"];

  return (
    <div className="space-y-4">
      {/* Period toggle */}
      <div className="flex gap-2 p-1 bg-surface-2 rounded-xl">
        {(["week", "month"] as const).map((p) => (
          <button
            key={p}
            type="button"
            onClick={() => setPeriod(p)}
            className={`flex-1 py-2 rounded-lg text-xs font-bold transition-colors ${
              period === p ? "bg-surface-1 text-white" : "text-zinc-500 hover:text-zinc-300"
            }`}
          >
            {p === "week" ? "Esta Semana" : "Este Mês"}
          </button>
        ))}
      </div>

      {/* Leaderboard */}
      <div className="space-y-2">
        {sorted.map((member, idx) => {
          const count = period === "week" ? member.workouts_this_week : member.workouts_this_month;
          const name = displayName(member);
          const isTop3 = idx < 3;

          return (
            <div
              key={member.student_id}
              className={`flex items-center gap-3 p-3 rounded-2xl border transition-colors ${
                isTop3
                  ? `${medalBg[idx]} border-transparent`
                  : "bg-surface-1/40 border-white/5"
              }`}
            >
              {/* Rank */}
              <div className="w-7 text-center flex-shrink-0">
                {isTop3 ? (
                  <TrophyIcon className={`w-5 h-5 mx-auto ${medalColors[idx]}`} />
                ) : (
                  <span className="text-xs text-zinc-600 font-bold tabular-nums">{idx + 1}</span>
                )}
              </div>

              <Avatar photo_url={member.photo_url} name={name} size="md" />

              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold text-white truncate">{name}</p>
                <p className="text-[10px] text-zinc-600">
                  Entrou em {new Date(member.joined_at).toLocaleDateString("pt-BR", { month: "short", year: "numeric" })}
                </p>
              </div>

              <div className="text-right flex-shrink-0">
                <p className={`text-lg font-black tabular-nums ${isTop3 ? medalColors[idx] : "text-zinc-400"}`}>
                  {count}
                </p>
                <p className="text-[9px] text-zinc-600">treino{count !== 1 ? "s" : ""}</p>
              </div>
            </div>
          );
        })}
      </div>

      {sorted.length === 0 && (
        <p className="text-center text-sm text-zinc-500 py-8">Nenhum dado ainda.</p>
      )}
    </div>
  );
}

// ── Feed Tab ──────────────────────────────────────────────────────────────────

function FeedTab({ feed, currentUserId }: { feed: FeedEntry[]; currentUserId: string }) {
  if (feed.length === 0) {
    return (
      <div className="py-12 text-center">
        <BoltIcon className="w-8 h-8 text-zinc-700 mx-auto mb-3" />
        <p className="text-sm text-zinc-500">Nenhuma atividade ainda.</p>
        <p className="text-xs text-zinc-600 mt-1">
          Complete um treino para aparecer aqui!
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {feed.map((entry) => {
        const name = displayName(entry);
        const isMe = entry.student_id === currentUserId;
        return (
          <div key={entry.id} className="flex gap-3 p-3 bg-surface-1/40 border border-white/5 rounded-2xl">
            <Avatar photo_url={entry.photo_url} name={name} size="sm" />
            <div className="flex-1 min-w-0">
              <p className="text-xs text-zinc-300 leading-relaxed">
                <span className="font-bold text-white">
                  {isMe ? "Você" : name}
                </span>
                {" "}completou{" "}
                <span className="text-primary font-semibold">{entry.collection_name}</span>
              </p>
              <p className="text-[10px] text-zinc-600 mt-0.5">
                {timeAgo(entry.finished_at ?? entry.created_at)}
              </p>
            </div>
            <FireIcon className="w-4 h-4 text-orange-500/60 flex-shrink-0 mt-0.5" />
          </div>
        );
      })}
    </div>
  );
}

// ── Main Dashboard ────────────────────────────────────────────────────────────

type Tab = "ranking" | "feed";

export function SquadDashboard({
  squad,
  currentUserId,
}: {
  squad: SquadDetail;
  currentUserId: string;
}) {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>("ranking");
  const [copied, setCopied] = useState(false);
  const [pending, startTransition] = useTransition();
  const [leaveError, setLeaveError] = useState<string | null>(null);

  function copyCode() {
    navigator.clipboard.writeText(squad.invite_code).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  function handleLeave() {
    if (!confirm("Tem certeza que quer sair deste squad?")) return;
    startTransition(async () => {
      const result = await leaveSquad(squad.id);
      if (result.ok) {
        router.push("/app/gymconnect");
      } else {
        setLeaveError(result.message);
      }
    });
  }

  const isCreator = squad.created_by === currentUserId;

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="bg-surface-1 border border-white/5 rounded-3xl overflow-hidden">
        <div className="h-1 bg-gradient-to-r from-primary via-primary/50 to-transparent" />
        <div className="p-5">
          <div className="flex items-start justify-between gap-3">
            <div className="flex-1 min-w-0">
              <h1 className="text-xl font-black text-white leading-tight">{squad.name}</h1>
              {squad.description && (
                <p className="text-sm text-zinc-500 mt-1">{squad.description}</p>
              )}
            </div>
            {!isCreator && (
              <button
                type="button"
                onClick={handleLeave}
                disabled={pending}
                title="Sair do squad"
                className="p-2 text-zinc-600 hover:text-danger transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center"
              >
                <ArrowRightStartOnRectangleIcon className="w-5 h-5" />
              </button>
            )}
          </div>

          <div className="flex items-center gap-4 mt-3 text-xs text-zinc-500">
            <span className="flex items-center gap-1">
              <UsersIcon className="w-3.5 h-3.5" />
              {squad.members.length} membro{squad.members.length !== 1 ? "s" : ""}
            </span>
            <button
              type="button"
              onClick={copyCode}
              className="flex items-center gap-1 hover:text-zinc-300 transition-colors font-mono"
            >
              {copied ? <CheckIcon className="w-3.5 h-3.5 text-primary" /> : <ClipboardDocumentIcon className="w-3.5 h-3.5" />}
              {copied ? "Copiado!" : squad.invite_code}
            </button>
          </div>

          {leaveError && <p className="text-xs text-danger mt-2">{leaveError}</p>}

          {/* Member avatars */}
          <div className="flex items-center gap-1.5 mt-4">
            {squad.members.slice(0, 8).map((m) => (
              <Avatar
                key={m.student_id}
                photo_url={m.photo_url}
                name={displayName(m)}
                size="sm"
              />
            ))}
            {squad.members.length > 8 && (
              <span className="text-[10px] text-zinc-600 ml-1">+{squad.members.length - 8}</span>
            )}
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 p-1 bg-surface-1 rounded-2xl border border-white/5">
        <button
          type="button"
          onClick={() => setTab("ranking")}
          className={`flex-1 py-2.5 rounded-xl text-xs font-bold transition-colors flex items-center justify-center gap-1.5 ${
            tab === "ranking" ? "bg-primary text-black" : "text-zinc-500 hover:text-zinc-300"
          }`}
        >
          <TrophyIcon className="w-3.5 h-3.5" />
          Ranking
        </button>
        <button
          type="button"
          onClick={() => setTab("feed")}
          className={`flex-1 py-2.5 rounded-xl text-xs font-bold transition-colors flex items-center justify-center gap-1.5 ${
            tab === "feed" ? "bg-primary text-black" : "text-zinc-500 hover:text-zinc-300"
          }`}
        >
          <BoltIcon className="w-3.5 h-3.5" />
          Feed
        </button>
      </div>

      {/* Tab content */}
      {tab === "ranking" ? (
        <RankingTab members={squad.members} />
      ) : (
        <FeedTab feed={squad.feed} currentUserId={currentUserId} />
      )}
    </div>
  );
}
