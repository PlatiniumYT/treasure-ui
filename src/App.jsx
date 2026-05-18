import React, { useMemo, useState } from "react";
import { motion } from "framer-motion";
import { Anchor, Coins, Compass, Gem, Skull } from "lucide-react";
const Card = ({ children, className = "" }) => (
  <div className={className}>{children}</div>
);

const CardContent = ({ children, className = "" }) => (
  <div className={className}>{children}</div>
);

const Button = ({ children, className = "", ...props }) => (
  <button className={className} {...props}>
    {children}
  </button>
);

const SYMBOLS = [
  { id: "1", label: "1", payout: "x1", segments: 18, expected: 33.33, color: "bg-amber-400", text: "text-white" },
  { id: "2", label: "2", payout: "x2", segments: 15, expected: 27.78, color: "bg-emerald-600", text: "text-white" },
  { id: "5", label: "5", payout: "x5", segments: 8, expected: 14.81, color: "bg-sky-600", text: "text-white" },
  { id: "10", label: "10", payout: "x10", segments: 4, expected: 7.41, color: "bg-red-600", text: "text-white" },
  { id: "loot", label: "John Silver’s Loot", short: "Loot", payout: "Bonus", segments: 4, expected: 7.41, icon: Coins, color: "bg-green-900", text: "text-green-100" },
  { id: "marbles", label: "Ben’s Lost Marbles", short: "Marbles", payout: "Bonus", segments: 2, expected: 3.7, icon: Gem, color: "bg-blue-900", text: "text-blue-100" },
  { id: "map", label: "Billy Bones’ Map", short: "Map", payout: "Bonus", segments: 2, expected: 3.7, icon: Compass, color: "bg-orange-700", text: "text-orange-100" },
  { id: "treasure", label: "Captain Flint’s Treasure", short: "Treasure", payout: "Bonus", segments: 1, expected: 1.85, icon: Skull, color: "bg-red-900", text: "text-red-100" },
];

const BOOSTERS = ["2x", "3x", "5x", "7x", "10x", "20x"];
const BONUS_IDS = ["loot", "marbles", "map", "treasure"];

const BASE_PAYOUT_BY_ID = {
  "1": 1,
  "2": 2,
  "5": 5,
  "10": 10,
};

const INITIAL_HISTORY = [
  "5", "1", "5", "1", "loot", "2", "loot", "5", "1", "loot",
  "2", "1", "1", "1", "map", "2", "treasure", "2", "10", "loot",
  "1", "1", "2", "5", "marbles", "1", "2", "1", "10", "1",
  "1", "1", "2", "1", "2", "5", "2", "10", "2", "loot",
  "5", "2", "2", "1", "1", "10", "5", "10", "1", "2",
  "2", "1", "5", "1", "marbles", "2", "2", "2", "1", "5",
  "loot", "1", "5", "2", "marbles", "loot", "5", "1", "5", "2",
];

const BET_CODE_TO_ID = {
  1: "1",
  2: "2",
  3: "5",
  4: "10",
  5: "loot",
  6: "marbles",
  7: "map",
  8: "treasure",
};

const RESULT_TO_ID = {
  "1": "1",
  "2": "2",
  "5": "5",
  "10": "10",
  "John Silver's Loot": "loot",
  "John Silver’s Loot": "loot",
  "Ben's Lost Marbles": "marbles",
  "Ben’s Lost Marbles": "marbles",
  "Billy Bones' Map": "map",
  "Billy Bones’ Map": "map",
  "Captain Flint's Treasure": "treasure",
  "Captain Flint’s Treasure": "treasure",
};

function getBetCodeFromId(id) {
  return Number(Object.entries(BET_CODE_TO_ID).find(([, value]) => value === id)?.[0] || 1);
}

function getPayoutMultiplier(resultId, game) {
  if ((resultId === "map" || resultId === "treasure") && game?.minMul !== null && game?.minMul !== undefined) {
    return Number(game.minMul) || 0;
  }

  if (game?.finalMul !== null && game?.finalMul !== undefined) return Number(game.finalMul) || 0;
  if (game?.payoutMul !== null && game?.payoutMul !== undefined) return Number(game.payoutMul) || 0;
  return BASE_PAYOUT_BY_ID[resultId] || 0;
} 

function parsePragmaticHistory(payload) {
  const rows = Array.isArray(payload) ? payload : payload?.history || [];
  const chronological = [...rows].reverse();

  return {
    spins: chronological.map((row) => RESULT_TO_ID[row.gameResult] || String(row.rc || row.gameResult)),
    boosters: chronological
      .filter((row) => row.boosterMul)
      .map((row) => ({
        symbol: BET_CODE_TO_ID[row.boosterMul.betCode] || String(row.boosterMul.betCode),
        multi: `${row.boosterMul.mul}x`,
        win: Boolean(row.boosterWin),
        gameId: row.gameId,
      })),
    raw: chronological,
  };
}

function normalizeResultId(game) {
  return RESULT_TO_ID[game?.gameResult] || BET_CODE_TO_ID[game?.rc] || String(game?.gameResult || "");
}

function isManualGame(game) {
  return String(game?.gameId || "").startsWith("manual-") || String(game?.gameId || "").startsWith("initial-") || String(game?.gameType || "").includes("local");
}

function mergeGames(existingGames, importedGames) {
  const officialImported = importedGames.filter((game) => !isManualGame(game));
  const existingOfficial = existingGames.filter((game) => !isManualGame(game));
  const existingManual = existingGames.filter((game) => isManualGame(game));

  const officialMap = new Map();
  [...existingOfficial, ...officialImported].forEach((game, index) => {
    const key = game.gameId || `${game.gameStart || 0}-${game.gameResult || game.rc}-${index}`;
    officialMap.set(key, game);
  });

  const officialGames = [...officialMap.values()];

  const manualGamesToKeep = existingManual.filter((manualGame) => {
    const manualResult = normalizeResultId(manualGame);
    const manualTime = Number(manualGame.gameStart || 0);

    const hasOfficialReplacement = officialGames.some((officialGame) => {
      const officialResult = normalizeResultId(officialGame);
      const officialTime = Number(officialGame.gameStart || 0);
      const sameResult = manualResult === officialResult;
      const closeInTime = manualTime && officialTime && Math.abs(officialTime - manualTime) <= 6 * 60 * 1000;
      return sameResult && closeInTime;
    });

    return !hasOfficialReplacement;
  });

  return [...officialGames, ...manualGamesToKeep].sort((a, b) => Number(a.gameStart || 0) - Number(b.gameStart || 0));
}

function ResultToken({ value, size = "md" }) {
  const symbol = SYMBOLS.find((s) => s.id === value);
  const Icon = symbol?.icon;
  const isBonus = BONUS_IDS.includes(value);

  const wrappers = {
    "1": "from-yellow-700 via-amber-500 to-yellow-900",
    "2": "from-green-800 via-emerald-600 to-green-950",
    "5": "from-sky-900 via-sky-600 to-sky-950",
    "10": "from-red-900 via-red-600 to-red-950",
    loot: "from-lime-900 via-green-700 to-lime-950",
    marbles: "from-blue-950 via-blue-700 to-sky-950",
    map: "from-orange-950 via-orange-700 to-amber-900",
    treasure: "from-red-950 via-rose-700 to-red-950",
  };

  const sizeClass = size === "lg"
    ? isBonus
      ? "h-24 w-28"
      : "h-24 w-20"
    : isBonus
      ? "h-16 w-20"
      : "h-16 w-14";

  return (
    <motion.div
      whileHover={{ scale: 1.06, y: -2 }}
      className={`relative overflow-hidden rounded-[1rem] border-2 border-[#6b4a27] bg-gradient-to-b ${wrappers[value] || "from-zinc-700 to-zinc-900"} ${sizeClass} shadow-[0_8px_25px_rgba(0,0,0,0.55)]`}
      title={symbol?.label || value}
    >
      <div className="absolute inset-0 rounded-[1rem] border border-black/40" />
      <div className="absolute left-1 top-1 h-2 w-2 rounded-full bg-[#d2a56a] shadow-inner shadow-black/60" />
      <div className="absolute right-1 top-1 h-2 w-2 rounded-full bg-[#d2a56a] shadow-inner shadow-black/60" />
      <div className="absolute bottom-1 left-1 h-2 w-2 rounded-full bg-[#d2a56a] shadow-inner shadow-black/60" />
      <div className="absolute bottom-1 right-1 h-2 w-2 rounded-full bg-[#d2a56a] shadow-inner shadow-black/60" />

      <div className="relative flex h-full flex-col items-center justify-center px-1 text-center">
        {!isBonus ? (
          <>
            <div className="flex h-10 w-10 items-center justify-center rounded-full border-[3px] border-black/40 bg-black/20 shadow-inner shadow-black/50">
              <span className="text-3xl font-black tracking-tight text-white drop-shadow-[0_2px_2px_rgba(0,0,0,0.7)]">
                {value}
              </span>
            </div>
            <span className="mt-1 text-[10px] font-black uppercase tracking-wide text-amber-100/90">
              {symbol?.payout}
            </span>
          </>
        ) : (
          <>
            <div className="mb-1 flex h-8 w-8 items-center justify-center rounded-full border border-amber-200/20 bg-black/20">
              {Icon && <Icon className="h-4 w-4 text-amber-100" />}
            </div>
            <span className="text-[10px] font-black uppercase leading-tight tracking-wide text-amber-50 drop-shadow">
              {symbol?.short || symbol?.label}
            </span>
            <span className="mt-1 text-[9px] font-black uppercase text-yellow-200/80">
              Bonus
            </span>
          </>
        )}
      </div>
    </motion.div>
  );
}

function Panel({ title, subtitle, children, collapsed, onToggle, action }) {
  return (
    <Card className="h-full overflow-hidden border-white/10 bg-[#071927]/80 text-white shadow-[0_25px_70px_rgba(0,0,0,0.45)] backdrop-blur-xl">
      <CardContent className="p-0">
        <div className="border-b border-white/10 bg-gradient-to-r from-white/10 via-white/5 to-transparent p-5">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="text-xl font-black tracking-tight text-white">{title}</h2>
              {subtitle && <p className="text-sm text-slate-300">{subtitle}</p>}
            </div>
            <div className="flex items-center gap-2">
              {action}
              <Button onClick={onToggle} className="rounded-xl border border-white/10 bg-black/25 hover:bg-white/15">
                {collapsed ? "+" : "−"}
              </Button>
            </div>
          </div>
        </div>
        {!collapsed && <div className="p-5">{children}</div>}
      </CardContent>
    </Card>
  );
}

export default function TreasureIslandDashboard() {
  const [history, setHistory] = useState(INITIAL_HISTORY);
  const [boosters, setBoosters] = useState([]);
  const [rawGames, setRawGames] = useState([]);
  const [importStatus, setImportStatus] = useState("Aucun fichier importé");
    const [liveMode, setLiveMode] = useState(true);
  const [range, setRange] = useState("all");
  const [selectedBoosterSymbol, setSelectedBoosterSymbol] = useState("1");
  const [selectedBoosterMulti, setSelectedBoosterMulti] = useState("2x");
  const [selectedResult, setSelectedResult] = useState("1");
  const [panelOrder, setPanelOrder] = useState(["quick", "recent", "segments", "boosters", "simulator"]);
  const [panelSizes, setPanelSizes] = useState({
    quick: "full",
    recent: "full",
    segments: "full",
    boosters: "full",
    simulator: "full",
  });
  const [swapA, setSwapA] = useState("quick");
  const [swapB, setSwapB] = useState("recent");
    const [bankrollStart, setBankrollStart] = useState(1000);
  const [betAmounts, setBetAmounts] = useState({
    "1": 0,
    "2": 0,
    "5": 0,
    "10": 0,
    loot: 0,
    marbles: 0,
    map: 0,
    treasure: 0,
  });
  const [betSnapshots, setBetSnapshots] = useState({});
  const [simulationActive, setSimulationActive] = useState(false);
  const [simulationStartTime, setSimulationStartTime] = useState(null);
  const [simulationBaseLength, setSimulationBaseLength] = useState(0);
  const [simulationRanges, setSimulationRanges] = useState([]);
  const [simulationStartFrom, setSimulationStartFrom] = useState(0);
  const [excludedSimulationRows, setExcludedSimulationRows] = useState({});
  const [pausedSimulationRows, setPausedSimulationRows] = useState([]);
  const [lastPausedLength, setLastPausedLength] = useState(null);
  const [editingSimulationRowId, setEditingSimulationRowId] = useState(null);
  const [editingBetAmounts, setEditingBetAmounts] = useState(null);
  const [collapsedPanels, setCollapsedPanels] = useState({
    quick: false,
    recent: false,
    segments: false,
    boosters: false,
    simulator: false,
  });

  const togglePanel = (panel) => setCollapsedPanels((prev) => ({ ...prev, [panel]: !prev[panel] }));
  const togglePanelSize = (panel) => {
    setPanelSizes((prev) => ({
      ...prev,
      [panel]: prev[panel] === "full" ? "half" : "full",
    }));
  };
  const panelLabels = {
    quick: "Résultats manuels des tours",
    recent: "Tours récents",
    segments: "Tableau probabilités et retards",
    boosters: "Tracking booster",
    simulator: "Simulation de session",
  };

  const swapSelectedPanels = () => {
    if (swapA === swapB) return;
    setPanelOrder((prev) => {
      const next = [...prev];
      const indexA = next.indexOf(swapA);
      const indexB = next.indexOf(swapB);
      [next[indexA], next[indexB]] = [next[indexB], next[indexA]];
      return next;
    });
  };

  const ranges = [
    { id: "10m", label: "10 min" },
    { id: "30m", label: "30 min" },
    { id: "1h", label: "1 h" },
    { id: "6h", label: "6 h" },
    { id: "12h", label: "12 h" },
    { id: "24h", label: "24 h" },
    { id: "all", label: "Tous" },
  ];

  const filteredRawGames = useMemo(() => {
    if (!rawGames.length || range === "all") return rawGames;

    const rangeMs = {
      "10m": 10 * 60 * 1000,
      "30m": 30 * 60 * 1000,
      "1h": 60 * 60 * 1000,
      "6h": 6 * 60 * 60 * 1000,
      "12h": 12 * 60 * 60 * 1000,
      "24h": 24 * 60 * 60 * 1000,
    }[range];

    if (!rangeMs) return rawGames;
    const newestTime = Math.max(...rawGames.map((game) => Number(game.gameStart || 0)));
    return rawGames.filter((game) => newestTime - Number(game.gameStart || 0) <= rangeMs);
  }, [rawGames, range]);

  const trackedHistory = useMemo(() => {
    if (filteredRawGames.length) {
      return filteredRawGames.map((game) => RESULT_TO_ID[game.gameResult] || BET_CODE_TO_ID[game.rc] || String(game.gameResult));
    }
    return history;
  }, [filteredRawGames, history]);

  const trackedBoosters = useMemo(() => {
    if (filteredRawGames.length) {
      return filteredRawGames
        .filter((game) => game.boosterMul)
        .map((game) => ({
          symbol: BET_CODE_TO_ID[game.boosterMul.betCode] || String(game.boosterMul.betCode),
          multi: `${game.boosterMul.mul}x`,
          win: Boolean(game.boosterWin),
          gameId: game.gameId,
        }));
    }
    return boosters;
  }, [filteredRawGames, boosters]);

  const stats = useMemo(() => {
    const total = trackedHistory.length;
    const counts = trackedHistory.reduce((acc, item) => {
      acc[item] = (acc[item] || 0) + 1;
      return acc;
    }, {});
    return { total, counts };
  }, [trackedHistory]);

  const symbolRows = useMemo(() => {
    return SYMBOLS.map((s) => {
      const count = stats.counts[s.id] || 0;
      const actual = stats.total ? (count / stats.total) * 100 : 0;
      const delay = [...trackedHistory].reverse().findIndex((x) => x === s.id);

      const probability = s.segments / 54;
      const theoreticalDelay = probability > 0 ? Math.round((1 / probability) * 9) : 0;

      const actualDiff = actual - s.expected;

      let delayColor = "text-emerald-300";
      if (typeof delay === "number") {
        const ratio = theoreticalDelay > 0 ? delay / theoreticalDelay : 0;

        if (ratio >= 0.9) {
          delayColor = "text-red-400";
        } else if (ratio >= 0.6) {
          delayColor = "text-orange-300";
        } else if (ratio >= 0.3) {
          delayColor = "text-yellow-300";
        }
      }

      return {
        ...s,
        count,
        actual,
        delay,
        theoreticalDelay,
        actualDiff,
        delayColor,
      };
    });
  }, [stats, trackedHistory]);

  const boosterStats = useMemo(() => {
    const total = trackedBoosters.length;

    const byMulti = trackedBoosters.reduce((acc, b) => {
      acc[b.multi] = (acc[b.multi] || 0) + 1;
      return acc;
    }, {});

    const bySymbol = trackedBoosters.reduce((acc, b) => {
      acc[b.symbol] = (acc[b.symbol] || 0) + 1;
      return acc;
    }, {});

    const wins = trackedBoosters.filter((b) => b.win).length;

    const winsByMulti = trackedBoosters.reduce((acc, b) => {
      if (b.win) {
        acc[b.multi] = (acc[b.multi] || 0) + 1;
      }
      return acc;
    }, {});
    const hitRate = total ? (wins / total) * 100 : 0;

    const symbolRows = SYMBOLS.map((s) => {
      const count = bySymbol[s.id] || 0;
      const pct = total ? (count / total) * 100 : 0;
      const delayIndex = [...trackedBoosters].reverse().findIndex((b) => b.symbol === s.id);
      const delay = delayIndex < 0 ? trackedHistory.length : delayIndex;
      const hitDelayIndex = [...trackedBoosters].reverse().findIndex((b) => b.symbol === s.id && b.win);
      const hitDelay = hitDelayIndex < 0 ? trackedHistory.length : hitDelayIndex;
      const wins = trackedBoosters.filter((b) => b.symbol === s.id && b.win).length;
      const hitRate = count ? (wins / count) * 100 : 0;
      return {
        ...s,
        count,
        pct,
        delay,
        hitDelay,
        wins,
        hitRate,
      };
    });

    const multiRows = BOOSTERS.map((m) => {
      const count = byMulti[m] || 0;
      const wins = winsByMulti[m] || 0;
      const pct = total ? (count / total) * 100 : 0;
      const hitRate = count ? (wins / count) * 100 : 0;
      const delayIndex = [...trackedBoosters].reverse().findIndex((b) => b.multi === m);
      const delay = delayIndex < 0 ? trackedHistory.length : delayIndex;
      return {
        multi: m,
        count,
        wins,
        pct,
        hitRate,
        delay: delay < 0 ? "—" : delay,
      };
    });

    return { total, byMulti, bySymbol, wins, hitRate, symbolRows, multiRows };
  }, [trackedBoosters]);

  const recentGames = useMemo(() => {
    if (filteredRawGames.length) return [...filteredRawGames].reverse();

    return trackedHistory.slice().reverse().map((item, index) => {
      const booster = trackedBoosters[trackedBoosters.length - 1 - index];
      return {
        gameId: `manuel-${index + 1}`,
        gameResult: SYMBOLS.find((s) => s.id === item)?.label || item,
        rc: getBetCodeFromId(item),
        boosterMul: booster ? { betCode: getBetCodeFromId(booster.symbol), mul: Number(String(booster.multi).replace("x", "")) } : null,
        boosterWin: Boolean(booster?.win),
        payoutMul: Number(item) || null,
        finalMul: null,
      };
    });
  }, [filteredRawGames, trackedHistory, trackedBoosters]);

  const addManualSpin = () => {
    const betSnapshotAtSpin = getCurrentBetSnapshot();
    const boosterBetCode = getBetCodeFromId(selectedBoosterSymbol);
    const resultSymbol = SYMBOLS.find((s) => s.id === selectedResult);
    const boosterWin = selectedResult === selectedBoosterSymbol;
    const baseMul = BASE_PAYOUT_BY_ID[selectedResult] || null;
    const boosterMulNumber = Number(selectedBoosterMulti.replace("x", ""));
    const resultCode = getBetCodeFromId(selectedResult);

    const manualGame = {
      gameId: `manual-${Date.now()}`,
      gameResult: resultSymbol?.label || selectedResult,
      rc: resultCode,
      boosterMul: { betCode: boosterBetCode, mul: boosterMulNumber },
      payoutMul: baseMul,
      finalMul: boosterWin && baseMul ? baseMul * boosterMulNumber : baseMul,
      boosterWin,
      gameStart: Date.now(),
      bonusGame: BONUS_IDS.includes(selectedResult),
    };

    setHistory((h) => [...h, selectedResult]);
    setBoosters((b) => [...b, { symbol: selectedBoosterSymbol, multi: selectedBoosterMulti, win: boosterWin }]);
    setRawGames((games) => {
      const baseGames = games.length
        ? games
        : history.map((id, index) => {
            const symbol = SYMBOLS.find((s) => s.id === id);
            return {
              gameId: `initial-${index}`,
              gameResult: symbol?.label || id,
              rc: getBetCodeFromId(id),
              boosterMul: null,
              payoutMul: Number(id) || null,
              finalMul: Number(id) || null,
              boosterWin: false,
              gameStart: Date.now() - (history.length - index) * 45000,
              bonusGame: BONUS_IDS.includes(id),
            };
          });
      const nextGames = [...baseGames, manualGame];
      const newIndex = nextGames.length - 1;
      if (simulationActive) {
        setBetSnapshots((prev) => ({ ...prev, [newIndex]: betSnapshotAtSpin }));
      }
      return nextGames;
    });
  };

  const undoLastSpin = () => {
    setHistory((h) => h.slice(0, -1));
    setBoosters((b) => b.slice(0, -1));
    setRawGames((games) => games.slice(0, -1));
  };

  const exportJsonData = () => {
    const exportGames = rawGames.length
      ? rawGames
      : history.map((id, index) => {
          const symbol = SYMBOLS.find((s) => s.id === id);
          return {
            gameId: `manual-export-${index}`,
            gameType: "treasure-island-local",
            gameResult: symbol?.label || id,
            rc: getBetCodeFromId(id),
            boosterMul: boosters[index]
              ? {
                  betCode: getBetCodeFromId(boosters[index].symbol),
                  mul: Number(String(boosters[index].multi).replace("x", "")) || 1,
                }
              : null,
            payoutMul: Number(id) || null,
            finalMul: Number(id) || null,
            boosterWin: Boolean(boosters[index]?.win),
            gameStart: Date.now() - (history.length - index) * 45000,
            bonusGame: BONUS_IDS.includes(id),
          };
        });

    const payload = {
      errorCode: "0",
      description: "Treasure Island Tracker Export",
      exportedAt: new Date().toISOString(),
      numberOfGames: exportGames.length,
      history: [...exportGames].sort((a, b) => Number(b.gameStart || 0) - Number(a.gameStart || 0)),
      appState: {
        panelOrder,
        panelSizes,
        betAmounts,
        bankrollStart,
      },
    };

    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `treasure_tracker_${new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-")}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleJsonUpload = (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      try {
        const payload = JSON.parse(String(reader.result));
        const parsed = parsePragmaticHistory(payload);

        setRawGames((previousGames) => {
          const mergedGames = mergeGames(previousGames, parsed.raw);

          setHistory(mergedGames.map((game) => RESULT_TO_ID[game.gameResult] || BET_CODE_TO_ID[game.rc] || String(game.gameResult)));
          setBoosters(
            mergedGames
              .filter((game) => game.boosterMul)
              .map((game) => ({
                symbol: BET_CODE_TO_ID[game.boosterMul.betCode] || String(game.boosterMul.betCode),
                multi: `${game.boosterMul.mul}x`,
                win: Boolean(game.boosterWin),
                gameId: game.gameId,
              }))
          );

          const addedCount = Math.max(0, mergedGames.length - previousGames.length);
          setImportStatus(`${addedCount} nouveaux spins ajoutés · ${mergedGames.length} spins au total`);
          return mergedGames;
        });
      } catch (error) {
        setImportStatus("Erreur : fichier JSON invalide");
      }
    };
    reader.readAsText(file);
    event.target.value = "";
  };

  const quickPanel = (
    <Panel
      title="Résultats manuels des tours"
      subtitle=""
      collapsed={collapsedPanels.quick}
      onToggle={() => togglePanel("quick")}
      action={<Button onClick={() => togglePanelSize("quick")} className="rounded-xl border border-white/10 bg-black/25 hover:bg-white/15">{panelSizes.quick === "full" ? "½" : "↔"}</Button>}
    >
      <div className="mb-4 flex justify-end gap-2">
        <Button onClick={undoLastSpin} className="rounded-xl border border-white/10 bg-black/25 hover:bg-white/15">Annuler</Button>
        <Button onClick={() => { setHistory([]); setBoosters([]); setRawGames([]); }} className="rounded-xl border border-white/10 bg-black/25 hover:bg-white/15">Reset</Button>
      </div>

      <div className="rounded-2xl border border-white/10 bg-black/25 p-4">
        <p className="mb-3 text-sm font-black text-slate-200">1. Résultat sorti</p>
        <div className="grid grid-cols-4 gap-3">
          {SYMBOLS.map((s) => (
            <button key={s.id} onClick={() => setSelectedResult(s.id)} className={`rounded-2xl border p-3 text-left transition ${selectedResult === s.id ? "border-amber-300 bg-amber-300/15" : "border-white/10 bg-black/25 hover:bg-white/10"}`}>
              <div className="flex items-center gap-3"><ResultToken value={s.id} /><div><p className="text-sm font-black">{s.short || s.label}</p><p className="text-xs text-slate-400">{s.payout}</p></div></div>
            </button>
          ))}
        </div>
      </div>

      <div className="mt-4 rounded-2xl border border-white/10 bg-black/25 p-4">
        <p className="mb-3 text-sm font-black text-slate-200">2. Booster affiché avant le tour</p>
        <div className="grid gap-3 md:grid-cols-[1fr_auto]">
          <div className="grid grid-cols-4 gap-2">
            {SYMBOLS.map((s) => (
              <button key={s.id} onClick={() => setSelectedBoosterSymbol(s.id)} className={`rounded-xl border px-3 py-2 text-sm font-bold transition ${selectedBoosterSymbol === s.id ? "border-purple-300 bg-purple-400/15 text-purple-100" : "border-white/10 bg-black/25 text-slate-300 hover:bg-white/10"}`}>
                {s.short || s.label}
              </button>
            ))}
          </div>
          <div className="flex flex-wrap gap-2 md:max-w-[180px]">
            {BOOSTERS.map((m) => (
              <button key={m} onClick={() => setSelectedBoosterMulti(m)} className={`rounded-xl border px-3 py-2 text-sm font-black transition ${selectedBoosterMulti === m ? "border-amber-300 bg-amber-300/15 text-amber-200" : "border-white/10 bg-black/25 text-slate-300 hover:bg-white/10"}`}>
                {m}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="mt-4 grid gap-4 rounded-2xl bg-black/25 p-4 md:grid-cols-[1fr_auto] md:items-center">
        <div className="flex flex-wrap items-center gap-3">
          <ResultToken value={selectedResult} />
          <div className="text-sm text-slate-300">
            <p><b className="text-white">Sortie :</b> {SYMBOLS.find((s) => s.id === selectedResult)?.short || selectedResult}</p>
            <p><b className={selectedResult === selectedBoosterSymbol ? "text-emerald-300" : "text-black"}>{selectedResult === selectedBoosterSymbol ? "Booster tombé sur le résultat" : "Booster non tombé sur le résultat"}</b> · {SYMBOLS.find((s) => s.id === selectedBoosterSymbol)?.short || selectedBoosterSymbol} ×{selectedBoosterMulti}</p>
          </div>
        </div>
        <Button onClick={addManualSpin} className="rounded-xl bg-amber-500 px-6 py-3 font-black text-black hover:bg-amber-400">Ajouter le tour</Button>
      </div>
    </Panel>
  );

  const recentPanel = (
    <Panel
      title="Tours récents"
      subtitle=""
      collapsed={collapsedPanels.recent}
      onToggle={() => togglePanel("recent")}
      action={<Button onClick={() => togglePanelSize("recent")} className="rounded-xl border border-white/10 bg-black/25 hover:bg-white/15">{panelSizes.recent === "full" ? "½" : "↔"}</Button>}
    >
      <div className="mb-3 flex items-center justify-between rounded-2xl bg-black/25 px-4 py-3 text-sm text-slate-300">
        <span>{recentGames.length} tours affichés</span>
        
      </div>
      <div className="max-h-[720px] space-y-2 overflow-y-auto pr-1">
        {recentGames.map((game, index) => {
          const resultId = RESULT_TO_ID[game.gameResult] || BET_CODE_TO_ID[game.rc] || String(game.gameResult);
          const boosterId = game.boosterMul ? BET_CODE_TO_ID[game.boosterMul.betCode] : null;
          const resultSymbol = SYMBOLS.find((s) => s.id === resultId);
          const boosterSymbol = SYMBOLS.find((s) => s.id === boosterId);
          const boosterHits = Boolean(game.boosterWin) || (boosterId && boosterId === resultId);

          return (
            <div key={game.gameId || index} className="grid gap-4 rounded-[1.4rem] border border-white/10 bg-gradient-to-r from-black/35 to-black/20 p-4 sm:grid-cols-[auto_1fr_auto] sm:items-center">
              <div className="flex items-center justify-center">
                <ResultToken value={resultId} size="lg" />
              </div>

              <div className="flex min-w-0 items-center justify-between gap-4">
                <div className="min-w-0">
                  <p className="truncate text-lg font-black text-white">
                    {resultSymbol?.short || resultSymbol?.label || resultId}
                  </p>

                  {(resultId === "map" || resultId === "treasure") && (game.minMul || game.maxMul) && (
                    <p className="mt-1 text-xs text-orange-300">
                      Potentiel bonus :
                      {game.minMul ? ` x${game.minMul}` : " ?"}
                      {game.maxMul ? ` à x${game.maxMul}` : ""}
                    </p>
                  )}
                </div>

                {boosterSymbol ? (
                  <div className={`flex items-center gap-3 rounded-2xl border px-3 py-2 ${boosterHits ? "border-emerald-400/20 bg-emerald-500/10" : "border-red-400/20 bg-red-500/10"}`}>
                    <ResultToken value={boosterId} />
                    <div className="text-right">
                      <p className={`text-lg font-black ${boosterHits ? "text-emerald-300" : "text-red-300"}`}>
                        x{game.boosterMul.mul}
                      </p>
                      <p className="text-[11px] uppercase tracking-wide text-slate-400">
                        {boosterHits ? "Touché" : "Loupé"}
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-xs text-slate-500">
                    Aucun booster
                  </div>
                )}
              </div>

              <div className={`min-w-[110px] rounded-2xl px-4 py-4 text-center text-2xl font-black shadow-inner ${boosterHits ? "bg-emerald-500/20 text-emerald-300" : "bg-white/10 text-slate-200"}`}>
                {(resultId === "map" || resultId === "treasure") && (game.minMul || game.maxMul)
                  ? `x${game.minMul || "?"}${game.maxMul ? ` - x${game.maxMul}` : ""}`
                  : `x${game.finalMul || game.payoutMul || 1}`}
              </div>
            </div>
          );
        })}
      </div>
    </Panel>
  );

  const segmentsPanel = (
    <Panel
      title="Tableau probabilités et retards"
      subtitle=""
      collapsed={collapsedPanels.segments}
      onToggle={() => togglePanel("segments")}
      action={<Button onClick={() => togglePanelSize("segments")} className="rounded-xl border border-white/10 bg-black/25 hover:bg-white/15">{panelSizes.segments === "full" ? "½" : "↔"}</Button>}
    >
      <div className="overflow-hidden rounded-2xl border border-white/10">
        <table className="w-full text-sm">
          <thead className="bg-black/35 text-slate-300">
            <tr><th className="p-3 text-left">Symbole</th><th className="p-3 text-right">Segments</th><th className="p-3 text-right">Théorique</th><th className="p-3 text-right">Réel</th><th className="p-3 text-right">Retard</th><th className="p-3 text-right">Retard max</th></tr>
          </thead>
          <tbody>
            {symbolRows.map((s) => (
              <tr key={s.id} className="border-t border-white/10">
                <td className="p-3">
                  <div className="flex items-center gap-3 font-black">
                    <ResultToken value={s.id} />
                    <span className={`${s.text} font-black`}>{s.short || s.label}</span>
                  </div>
                </td><td className={`p-3 text-right font-black ${s.text}`}>{s.segments}</td><td className="p-3 text-right text-slate-200 font-black">{s.expected.toFixed(2)}%</td><td className={`p-3 text-right font-black ${s.actualDiff >= 0 ? "text-emerald-300" : "text-red-300"}`}>{s.actual.toFixed(1)}%</td><td className={`p-3 text-right font-black ${s.delayColor}`}>{s.delay}</td><td className="p-3 text-right font-black text-slate-200">{s.theoreticalDelay}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Panel>
  );

  const boostersPanel = (
    <Panel
      title="Tracking booster"
      subtitle="Vue claire des multiplicateurs, symboles boostés et boosters gagnants"
      collapsed={collapsedPanels.boosters}
      onToggle={() => togglePanel("boosters")}
      action={<Button onClick={() => togglePanelSize("boosters")} className="rounded-xl border border-white/10 bg-black/25 hover:bg-white/15">{panelSizes.boosters === "full" ? "½" : "↔"}</Button>}
    >
      <div className="space-y-4">
        <div className="grid gap-3 md:grid-cols-3">
          <div className="rounded-2xl border border-white/10 bg-black/30 p-4">
            <p className="text-xs font-bold uppercase tracking-wide text-slate-400">Boosters trackés</p>
            <p className="mt-1 text-3xl font-black text-white">{boosterStats.total}</p>
          </div>
          <div className="rounded-2xl border border-white/10 bg-emerald-950/30 p-4">
            <p className="text-xs font-bold uppercase tracking-wide text-slate-400">Boosters gagnants</p>
            <p className="mt-1 text-3xl font-black text-emerald-300">{boosterStats.wins}</p>
          </div>
          <div className="rounded-2xl border border-white/10 bg-black/30 p-4">
            <p className="text-xs font-bold uppercase tracking-wide text-slate-400">Taux de réussite</p>
            <p className="mt-1 text-3xl font-black text-amber-300">{boosterStats.hitRate.toFixed(1)}%</p>
          </div>
        </div>

        <div className="grid gap-4 xl:grid-cols-[1fr_1fr]">
          <div className="rounded-2xl border border-white/10 bg-black/25 p-4">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <h3 className="text-lg font-black">Multiplicateurs</h3>
                <p className="text-sm text-slate-400">Fréquence et retards par multiplicateur</p>
              </div>
            </div>
            <div className="space-y-3">
              {boosterStats.multiRows.map((row) => (
                <div key={row.multi} className="rounded-2xl bg-white/5 p-3">
                  <div className="mb-2 flex items-center justify-between text-sm">
                    <span className="text-xl font-black text-amber-300">{row.multi}</span>
                    <span className="font-bold text-slate-300">{row.count} fois · {row.pct.toFixed(1)}%</span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-black/40">
                    <div className="h-full rounded-full bg-amber-300" style={{ width: `${Math.min(100, row.pct)}%` }} />
                  </div>
                  <div className="mt-2 flex items-center justify-between text-xs">
                    <span className="text-slate-400">Retard sans booster gagnant : <b className="text-slate-200">{row.delay}</b></span>
                    <div className="text-right">
                      <span className="block font-black text-emerald-300">Boosters gagnants : {row.wins}</span>
                      <span className="text-slate-500">Taux de réussite : {row.hitRate.toFixed(1)}%</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-2xl border border-white/10 bg-black/25 p-4">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <h3 className="text-lg font-black">Symboles boostés</h3>
                <p className="text-sm text-slate-400">Quel symbole reçoit le plus souvent un booster</p>
              </div>
            </div>
            <div className="space-y-2">
              {boosterStats.symbolRows.map((row) => (
                <div key={row.id} className="grid grid-cols-[auto_1fr_auto] items-center gap-3 rounded-2xl bg-white/5 p-3">
                  <ResultToken value={row.id} />
                  <div>
                    <div className="mb-1 flex items-center justify-between gap-3 text-sm">
                      <span className={`${row.text} font-black`}>{row.short || row.label}</span>
                      <span className="font-bold text-slate-300">{row.count} · {row.pct.toFixed(1)}% · gagnants {row.wins}</span>
                    </div>
                    <div className="h-2 overflow-hidden rounded-full bg-black/40">
                      <div className="h-full rounded-full bg-white/60" style={{ width: `${Math.min(100, row.pct)}%` }} />
                    </div>
                  </div>
                  <div className="grid gap-1 text-right text-xs font-bold text-slate-300">
                    <div className="rounded-xl bg-black/30 px-3 py-2">
                      Retard boost<br /><span className="text-sm text-white">{row.delay}</span>
                    </div>
                    <div className="rounded-xl bg-emerald-950/30 px-3 py-2">
                      Retard booster gagnant<br /><span className="text-sm text-emerald-300">{row.hitDelay}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-white/10 bg-black/25 p-4">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h3 className="text-lg font-black">Derniers boosters</h3>
              <p className="text-sm text-slate-400">Lecture rapide des derniers boosters affichés</p>
            </div>
          </div>
          <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-4">
            {trackedBoosters.slice(-16).reverse().map((b, i) => {
              const s = SYMBOLS.find((x) => x.id === b.symbol);
              return (
                <div key={`${b.gameId || i}-${b.multi}`} className={`rounded-2xl border p-3 ${b.win ? "border-emerald-400/30 bg-emerald-950/30" : "border-white/10 bg-white/5"}`}>
                  <div className="mb-2 flex items-center justify-between">
                    <ResultToken value={b.symbol} />
                    <span className="rounded-xl bg-amber-300 px-3 py-1 text-sm font-black text-black">{b.multi}</span>
                  </div>
                  <p className="text-sm font-black">{s?.short || s?.label}</p>
                  <p className={`text-xs font-bold ${b.win ? "text-emerald-300" : "text-slate-400"}`}>{b.win ? "Tombé sur le résultat" : "Non tombé sur le résultat"}</p>
                </div>
              );
            })}
            {trackedBoosters.length === 0 && (
              <div className="rounded-2xl border border-dashed border-white/10 p-8 text-center text-sm text-slate-400 md:col-span-2 xl:col-span-4">
                Aucun booster sur cette période.
              </div>
            )}
          </div>
        </div>
      </div>
    </Panel>
  );

  const updateBetAmount = (id, value) => {
    setBetAmounts((prev) => ({ ...prev, [id]: Math.max(0, Number(value) || 0) }));
  };

  const getCurrentBetSnapshot = () => ({ ...betAmounts });

  const getCurrentHistoryLength = () => rawGames.length || history.length;

  const startSimulation = () => {
    if (simulationActive) return;

    const currentLength = getCurrentHistoryLength();
    const isResume = simulationRanges.length > 0;
    const manualStart = Math.max(0, Number(simulationStartFrom) || 0);
    const startIndex = isResume ? currentLength : Math.min(manualStart, currentLength);

    setSimulationBaseLength(startIndex);
    setSimulationStartTime(Date.now());
    setSimulationRanges((prev) => [...prev, { startIndex, endIndex: null, betSnapshot: getCurrentBetSnapshot() }]);
    setSimulationActive(true);
  };

  const stopSimulation = () => {
    if (!simulationActive) return;

    const currentLength = getCurrentHistoryLength();

    setSimulationRanges((prev) => {
      if (!prev.length) return prev;
      const next = [...prev];
      next[next.length - 1] = { ...next[next.length - 1], endIndex: currentLength };
      return next;
    });

    setLastPausedLength(currentLength);
    setSimulationActive(false);
  };

  const resetSimulation = () => {
    setSimulationActive(false);
    setSimulationStartTime(null);
    setSimulationBaseLength(rawGames.length || history.length);
    setSimulationRanges([]);
    setExcludedSimulationRows({});
    setPausedSimulationRows([]);
    setBetSnapshots({});
    setLastPausedLength(null);
  };

  const toggleSimulationRow = (id) => {
    setExcludedSimulationRows((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const startEditSimulationRow = (entry) => {
    setEditingSimulationRowId(entry.id);
    setEditingBetAmounts({ ...entry.betSnapshot });
  };

  const updateEditingBetAmount = (id, value) => {
    setEditingBetAmounts((prev) => ({
      ...(prev || {}),
      [id]: Math.max(0, Number(value) || 0),
    }));
  };

  const saveEditingSimulationRow = (entry) => {
    if (!editingBetAmounts) return;
    setBetSnapshots((prev) => ({ ...prev, [entry.sourceIndex]: { ...editingBetAmounts } }));
    setEditingSimulationRowId(null);
    setEditingBetAmounts(null);
  };

  const cancelEditingSimulationRow = () => {
    setEditingSimulationRowId(null);
    setEditingBetAmounts(null);
  };

  const simulationRows = useMemo(() => {
    if (!simulationRanges.length) return [];

    const sourceGames = rawGames.length
      ? rawGames.map((game, index) => ({
          raw: game,
          result: RESULT_TO_ID[game.gameResult] || BET_CODE_TO_ID[game.rc] || String(game.gameResult),
          gameStart: Number(game.gameStart || 0),
          sourceIndex: index,
        }))
      : history.map((result, index) => ({
          raw: null,
          result,
          gameStart: 0,
          sourceIndex: index,
        }));

    return sourceGames
      .map((entry, index) => {
        const activeRange = simulationRanges.find((range) => {
          const afterStart = index >= range.startIndex;
          const beforeEnd = range.endIndex === null ? true : index < range.endIndex;
          return afterStart && beforeEnd;
        });

        if (!activeRange) return null;

        const result = entry.result;
        const snapshot = betSnapshots[entry.sourceIndex] || activeRange.betSnapshot || betAmounts;
        const totalStake = SYMBOLS.reduce((sum, s) => sum + (Number(snapshot[s.id]) || 0), 0);
        const betOnResult = Number(snapshot[result]) || 0;
        const payout = getPayoutMultiplier(result, entry.raw);
        const win = betOnResult * payout;
        const profit = win - totalStake;

        return {
          id: `${entry.sourceIndex}-${result}`,
          sourceIndex: entry.sourceIndex,
          result,
          betSnapshot: snapshot,
          totalStake,
          betOnResult,
          payout,
          win,
          profit,
        };
      })
      .filter(Boolean);
  }, [rawGames, history, simulationRanges, betAmounts, betSnapshots]);

  const includedSimulationRows = useMemo(() => {
    return simulationRows.filter((row) => !excludedSimulationRows[row.id]);
  }, [simulationRows, excludedSimulationRows]);

  const simulationTotal = useMemo(() => {
    const stake = includedSimulationRows.reduce((sum, row) => sum + row.totalStake, 0);
    const win = includedSimulationRows.reduce((sum, row) => sum + row.win, 0);
    const profit = includedSimulationRows.reduce((sum, row) => sum + row.profit, 0);
    return {
      stake,
      win,
      profit,
      bankroll: bankrollStart + profit,
    };
  }, [includedSimulationRows, bankrollStart]);

  const simulatorPanel = (
    <Panel
      title="Simulation de session"
      subtitle="Comme si tu jouais directement sur le jeu"
      collapsed={collapsedPanels.simulator}
      onToggle={() => togglePanel("simulator")}
      action={<Button onClick={() => togglePanelSize("simulator")} className="rounded-xl border border-white/10 bg-black/25 hover:bg-white/15">{panelSizes.simulator === "full" ? "½" : "↔"}</Button>}
    >
      <div className="grid gap-4 lg:grid-cols-[360px_1fr]">
        <div className="space-y-4">
          <div className="rounded-2xl border border-white/10 bg-black/25 p-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label className="text-sm font-bold text-slate-200">Bankroll départ</label>
                <input
                  type="number"
                  min="0"
                  step="1"
                  value={bankrollStart}
                  onChange={(e) => setBankrollStart(Number(e.target.value) || 0)}
                  disabled={simulationActive}
                  className="mt-2 w-full rounded-xl border border-white/10 bg-black/40 px-3 py-3 text-white outline-none disabled:opacity-50"
                />
              </div>
              <div>
                <p className="text-sm text-slate-400">Bankroll actuelle</p>
                <p className={`mt-2 text-3xl font-black ${simulationTotal.profit > 0 ? "text-emerald-300" : simulationTotal.profit < 0 ? "text-red-300" : "text-slate-300"}`}>€{simulationTotal.bankroll.toFixed(2)}</p>
              </div>
            </div>

            <div className="mt-4 rounded-2xl border border-white/10 bg-black/30 p-3">
              <div className="flex items-center justify-between gap-3">
                <div className="flex-1">
                  <label className="text-sm font-bold text-slate-200">Commencer à partir du tour #</label>
                  <input
                    type="number"
                    min="0"
                    value={simulationStartFrom}
                    onChange={(e) => setSimulationStartFrom(Math.max(0, Number(e.target.value) || 0))}
                    className="mt-2 w-full rounded-xl border border-white/10 bg-black/40 px-3 py-3 text-white outline-none"
                    placeholder="Exemple : 500"
                  />
                  <p className="mt-2 text-xs text-slate-400">
                    0 = historique complet · 500 = commencer au 500e tour.
                  </p>
                </div>

                <Button
                  onClick={startSimulation}
                  className="rounded-2xl bg-emerald-500 px-5 py-6 font-black text-black hover:bg-emerald-400"
                >
                  Démarrer
                </Button>
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-white/10 bg-black/25 p-4">
            <p className="mb-3 text-sm font-bold text-slate-200">Mise par issue / tour</p>
            <div className="space-y-2">
              {SYMBOLS.map((s) => (
                <div key={s.id} className="grid grid-cols-[auto_1fr_90px] items-center gap-3 rounded-xl bg-white/5 px-3 py-2">
                  <ResultToken value={s.id} />
                  <span className="text-sm font-bold">{s.short || s.label}</span>
                  <input
                    type="text"
                    inputMode="decimal"
                    value={betAmounts[s.id] === 0 ? "" : betAmounts[s.id]}
                    onChange={(e) => {
                      const cleaned = e.target.value.replace(",", ".");
                      if (/^\d*\.?\d*$/.test(cleaned)) {
                        updateBetAmount(s.id, cleaned);
                      }
                    }}
                    placeholder="0"
                    className="rounded-xl border border-white/10 bg-black/40 px-3 py-2 text-right text-sm font-black text-white outline-none placeholder:text-slate-500 focus:border-amber-300"
                  />
                </div>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-3 gap-2">
            <Button onClick={startSimulation} className="rounded-2xl bg-emerald-500 py-5 font-black text-black hover:bg-emerald-400">
              Reprendre
            </Button>
            <Button onClick={stopSimulation} className="rounded-2xl bg-white/10 py-5 font-black hover:bg-white/20">
              Pause
            </Button>
            <Button onClick={resetSimulation} className="rounded-2xl bg-red-500/20 py-5 font-black text-red-200 hover:bg-red-500/30">
              Reset
            </Button>
          </div>

          <div className="rounded-2xl bg-black/25 p-4 text-sm text-slate-300">
            <p><b className={simulationActive ? "text-emerald-300" : "text-slate-300"}>{simulationActive ? "Simulation active" : "Simulation inactive"}</b></p>
            <p>Point de départ : tour #{simulationBaseLength}. Les nouveaux tours ajoutés ensuite seront calculés, même avec un historique illimité.</p>
          </div>
        </div>

        <div className="rounded-2xl border border-white/10 bg-black/25 p-4">
          <div className="mb-4 grid gap-3 sm:grid-cols-3">
            <div className="rounded-2xl bg-black/25 p-4"><p className="text-xs text-slate-400">Mises totales</p><p className="text-2xl font-black">€{simulationTotal.stake.toFixed(2)}</p></div>
            <div className="rounded-2xl bg-black/25 p-4"><p className="text-xs text-slate-400">Gains totaux</p><p className="text-2xl font-black text-emerald-300">€{simulationTotal.win.toFixed(2)}</p></div>
            <div className="rounded-2xl bg-black/25 p-4"><p className="text-xs text-slate-400">Profit</p><p className={`text-2xl font-black ${simulationTotal.profit > 0 ? "text-emerald-300" : simulationTotal.profit < 0 ? "text-red-300" : "text-slate-300"}`}>{simulationTotal.profit >= 0 ? "+" : ""}€{simulationTotal.profit.toFixed(2)}</p></div>
          </div>

          <div className="mb-3 flex items-center justify-between">
            <div>
              <h3 className="text-lg font-black">Tours pris en compte</h3>
              <p className="text-sm text-slate-400">{includedSimulationRows.length}/{simulationRows.length} tours pris en compte</p>
            </div>
          </div>

          <div className="max-h-[600px] space-y-2 overflow-y-auto pr-1">
            {simulationRows.slice().reverse().map((entry, index) => {
              const excluded = Boolean(excludedSimulationRows[entry.id]);
              return (
              <div key={`${entry.id}-${index}`} className={`grid gap-3 rounded-2xl border p-3 lg:grid-cols-[auto_auto_1fr_auto] lg:items-center ${excluded ? "border-red-400/20 bg-red-950/20 opacity-60" : "border-white/10 bg-black/25"}`}>
                <input
                  type="checkbox"
                  checked={!excluded}
                  onChange={() => toggleSimulationRow(entry.id)}
                  className="h-5 w-5 accent-emerald-400"
                  title="Inclure / exclure ce tour"
                />
                <ResultToken value={entry.result} />
                <div>
                  <div className="mb-1 flex flex-wrap items-center gap-2">
                    <p className="text-sm font-black">Résultat : {SYMBOLS.find((s) => s.id === entry.result)?.short || entry.result}</p>
                    <button
                      onClick={() => editingSimulationRowId === entry.id ? cancelEditingSimulationRow() : startEditSimulationRow(entry)}
                      className="rounded-lg bg-white/10 px-2 py-1 text-xs font-bold text-slate-200 hover:bg-white/20"
                    >
                      {editingSimulationRowId === entry.id ? "Fermer" : "Modifier mises"}
                    </button>
                  </div>
                  <p className="text-xs text-slate-400">Mise totale €{entry.totalStake.toFixed(2)} · Mise gagnante €{entry.betOnResult.toFixed(2)} · Multiplicateur x{entry.payout} · Gain €{entry.win.toFixed(2)}</p>
                  <p className="text-xs text-slate-500">Mises du tour : {SYMBOLS.filter((s) => Number(entry.betSnapshot?.[s.id]) > 0).map((s) => `${s.short || s.label} €${Number(entry.betSnapshot[s.id]).toFixed(2)}`).join(" · ") || "aucune"}</p>

                  {editingSimulationRowId === entry.id && (
                    <div className="mt-3 rounded-2xl border border-white/10 bg-black/30 p-3">
                      <p className="mb-2 text-xs font-black text-amber-200">Modifier les mises de ce tour uniquement</p>
                      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
                        {SYMBOLS.map((s) => (
                          <label key={s.id} className="rounded-xl bg-white/5 p-2 text-xs font-bold text-slate-200">
                            {s.short || s.label}
                            <input
                              type="text"
                              inputMode="decimal"
                              value={editingBetAmounts?.[s.id] === 0 ? "" : editingBetAmounts?.[s.id] ?? ""}
                              onChange={(e) => {
                                const cleaned = e.target.value.replace(",", ".");
                                if (/^\d*\.?\d*$/.test(cleaned)) {
                                  updateEditingBetAmount(s.id, cleaned);
                                }
                              }}
                              placeholder="0"
                              className="mt-1 w-full rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-right font-black text-white outline-none placeholder:text-slate-500 focus:border-amber-300"
                            />
                          </label>
                        ))}
                      </div>
                      <div className="mt-3 flex justify-end gap-2">
                        <button onClick={cancelEditingSimulationRow} className="rounded-xl bg-white/10 px-3 py-2 text-xs font-bold hover:bg-white/20">Annuler</button>
                        <button onClick={() => saveEditingSimulationRow(entry)} className="rounded-xl bg-emerald-500 px-3 py-2 text-xs font-black text-black hover:bg-emerald-400">Sauvegarder</button>
                      </div>
                    </div>
                  )}
                </div>
                <div className={`rounded-xl px-4 py-2 text-sm font-black ${entry.profit > 0 ? "bg-emerald-500/20 text-emerald-300" : entry.profit < 0 ? "bg-red-500/20 text-red-300" : "bg-white/10 text-slate-300"}`}>
                  {entry.profit >= 0 ? "+" : ""}€{entry.profit.toFixed(2)}
                </div>
              </div>
            );
            })}

            {simulationRows.length === 0 && (
              <div className="rounded-2xl border border-dashed border-white/10 p-8 text-center text-sm text-slate-400">
                Active la simulation puis ajoute/import de nouveaux tours pour voir le calcul.
              </div>
            )}
          </div>
        </div>
      </div>
    </Panel>
  );

  const panels = { quick: quickPanel, recent: recentPanel, segments: segmentsPanel, boosters: boostersPanel, simulator: simulatorPanel };
  const openPanelIds = panelOrder.filter((id) => !collapsedPanels[id]);
  const collapsedPanelIds = panelOrder.filter((id) => collapsedPanels[id]);

  return (
    <div className="min-h-screen overflow-hidden bg-[radial-gradient(circle_at_20%_0%,#1d5b67_0%,transparent_36%),radial-gradient(circle_at_80%_10%,#7a4b18_0%,transparent_30%),linear-gradient(135deg,#031018_0%,#07131c_46%,#020611_100%)] p-6 text-white">
      <div className="pointer-events-none fixed inset-0 opacity-30 [background-image:linear-gradient(rgba(255,255,255,0.04)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.04)_1px,transparent_1px)] [background-size:48px_48px]" />
      <div className="relative mx-auto max-w-7xl space-y-6">
        <header className="overflow-hidden rounded-[2rem] border border-white/10 bg-[#071927]/75 p-6 shadow-[0_25px_80px_rgba(0,0,0,0.55)] backdrop-blur-xl">
          <div className="grid gap-5 lg:grid-cols-[1fr_260px] lg:items-center">
            <div>
              <div className="mb-2 flex items-center gap-2 text-sm text-slate-300">
                <span className={`h-2.5 w-2.5 rounded-full ${liveMode ? "bg-red-500 animate-pulse" : "bg-slate-500"}`} />
                {liveMode ? "Lecture live active" : "Lecture live en pause"}
              </div>
              <div className="flex items-center gap-3">
                <div className="rounded-2xl border border-amber-300/30 bg-amber-400/20 p-3 shadow-[0_0_35px_rgba(251,191,36,0.25)]"><Anchor className="h-7 w-7 text-amber-300" /></div>
                <div><h1 className="bg-gradient-to-r from-amber-200 via-yellow-400 to-orange-300 bg-clip-text text-5xl font-black tracking-tight text-transparent">Treasure Island</h1><p className="text-sm font-semibold text-slate-300">Tracker live · historique · boosters · JSON Pragmatic</p></div>
              </div>
            </div>

            <div className="space-y-3 rounded-[1.5rem] border border-white/10 bg-black/35 p-4">
              <Button onClick={() => setLiveMode(!liveMode)} className="w-full rounded-xl bg-white/10 hover:bg-white/20">{liveMode ? "Pause live" : "Activer live"}</Button>
              <label className="block cursor-pointer rounded-xl bg-amber-500 px-4 py-3 text-center text-sm font-black text-black transition hover:bg-amber-400">
                Import JSON
                <input type="file" accept="application/json,.json" onChange={handleJsonUpload} className="hidden" />
              </label>
              <Button onClick={exportJsonData} className="w-full rounded-xl bg-emerald-500 py-3 font-black text-black hover:bg-emerald-400">
                Export JSON
              </Button>
              <div className="rounded-2xl bg-black/25 px-4 py-3"><p className="text-xs text-slate-400">Import</p><p className="text-sm font-bold text-slate-200">{importStatus}</p></div>
            </div>
          </div>
        </header>

        <section className="grid gap-4 rounded-[1.5rem] border border-white/10 bg-[#071927]/75 p-4 shadow-xl backdrop-blur-xl lg:grid-cols-[1fr_auto] lg:items-center">
          <div className="flex flex-wrap gap-3">
            {ranges.map((r) => <button key={r.id} onClick={() => setRange(r.id)} className={`rounded-full border px-4 py-2 text-sm font-bold transition ${range === r.id ? "border-amber-300 bg-amber-400 text-black shadow-[0_0_25px_rgba(251,191,36,0.25)]" : "border-white/10 bg-black/25 text-slate-300 hover:bg-white/10"}`}>{r.label}</button>)}
          </div>
          <div className="flex flex-wrap items-center gap-2 rounded-2xl bg-black/25 p-2">
            <span className="px-2 text-xs font-bold text-slate-300">Intervertir</span>
            <select value={swapA} onChange={(e) => setSwapA(e.target.value)} className="rounded-xl border border-white/10 bg-black/40 px-3 py-2 text-sm text-white">
              {panelOrder.map((id) => <option key={id} value={id}>{panelLabels[id]}</option>)}
            </select>
            <span className="text-slate-400">avec</span>
            <select value={swapB} onChange={(e) => setSwapB(e.target.value)} className="rounded-xl border border-white/10 bg-black/40 px-3 py-2 text-sm text-white">
              {panelOrder.map((id) => <option key={id} value={id}>{panelLabels[id]}</option>)}
            </select>
            <Button onClick={swapSelectedPanels} className="rounded-xl bg-gradient-to-r from-amber-400 to-orange-400 font-black text-black shadow-[0_0_25px_rgba(251,191,36,0.2)] hover:from-amber-300 hover:to-orange-300">Appliquer</Button>
          </div>
        </section>

        <div className="relative">
          <main className="grid auto-rows-max grid-cols-1 gap-6 lg:grid-cols-12">
            {openPanelIds.map((id) => {
              const isHalf = panelSizes[id] === "half";

              return (
                <motion.div
                  layout
                  key={id}
                  drag
                  dragMomentum={false}
                  dragElastic={0.08}
                  whileDrag={{ scale: 1.02, zIndex: 50 }}
                  className={isHalf ? "lg:col-span-6" : "lg:col-span-12"}
                >
                  <div className="relative">
                    <div className="absolute -top-2 left-1/2 z-10 h-1.5 w-24 -translate-x-1/2 rounded-full bg-white/10" />
                    {panels[id]}
                  </div>
                </motion.div>
              );
            })}
          </main>

          {collapsedPanelIds.length > 0 && (
            <aside className="fixed right-4 top-1/2 z-40 flex max-h-[80vh] w-56 -translate-y-1/2 flex-col gap-3 overflow-y-auto rounded-[1.5rem] border border-white/10 bg-[#07131c]/95 p-4 shadow-2xl backdrop-blur-xl">
              <p className="text-xs font-black uppercase tracking-wide text-slate-400">Pages réduites</p>
              {collapsedPanelIds.map((id) => (
                <button
                  key={id}
                  onClick={() => togglePanel(id)}
                  className="w-full rounded-2xl border border-white/10 bg-black/30 p-3 text-left transition hover:scale-[1.02] hover:bg-white/10"
                >
                  <p className="font-black text-white">{panelLabels[id]}</p>
                  <p className="text-xs text-slate-400">Cliquer pour rouvrir</p>
                </button>
              ))}
            </aside>
          )}
        </div>
      </div>
    </div>
  );
}
