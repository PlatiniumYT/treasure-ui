import React, { useEffect, useMemo, useState } from "react";
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

const STORAGE_KEY = "treasure-island-tracker-v1";

const BET_LIMITS_BY_ID = {
  "1": 1000,
  "2": 1000,
  "5": 1000,
  "10": 500,
  loot: 500,
  marbles: 500,
  map: 200,
  treasure: 200,
};

const roundToTenth = (value) => Math.ceil((Number(value) || 0) * 10) / 10;
const roundAndClampBetAmount = (id, value) => clampBetAmount(id, roundToTenth(value));
const normalizeDecimalInput = (value) => String(value ?? "").replace(",", ".");
const isValidDecimalInput = (value) => /^\d*\.?\d*$/.test(value);
const clampBetAmount = (id, value) => {
  const max = BET_LIMITS_BY_ID[id] ?? 1000;
  const numeric = Math.max(0, Number(value) || 0);
  return Math.min(max, numeric);
};

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
  const [panelOrder, setPanelOrder] = useState(["quick", "recent", "segments", "boosters", "simulator", "wheel"]);
  const [panelSizes, setPanelSizes] = useState({
    quick: "full",
    recent: "full",
    segments: "full",
    boosters: "full",
    simulator: "full",
    wheel: "full",
  });
  const [pinnedPanels, setPinnedPanels] = useState({
    quick: true,
    recent: true,
    segments: true,
    boosters: true,
    simulator: true,
    wheel: true,
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
  const [strategyActive, setStrategyActive] = useState(false);
  const [strategyMultiplier, setStrategyMultiplier] = useState(2.2);
  const [strategySteps, setStrategySteps] = useState({
    "1": 1,
    "2": 2,
    "5": 5,
    "10": 10,
    loot: 5,
    marbles: 10,
    map: 10,
    treasure: 20,
  });
  const [strategyLossCounters, setStrategyLossCounters] = useState({
    "1": 0,
    "2": 0,
    "5": 0,
    "10": 0,
    loot: 0,
    marbles: 0,
    map: 0,
    treasure: 0,
  });
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
    wheel: false,
  });
  const [storageReady, setStorageReady] = useState(false);
  const [selectedWheelId, setSelectedWheelId] = useState("1");

  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const data = JSON.parse(saved);

        if (Array.isArray(data.history)) setHistory(data.history);
        if (Array.isArray(data.boosters)) setBoosters(data.boosters);
        if (Array.isArray(data.rawGames)) setRawGames(data.rawGames);
        if (data.importStatus) setImportStatus(data.importStatus);
        if (typeof data.liveMode === "boolean") setLiveMode(data.liveMode);
        if (data.range) setRange(data.range);
        if (data.selectedBoosterSymbol) setSelectedBoosterSymbol(data.selectedBoosterSymbol);
        if (data.selectedBoosterMulti) setSelectedBoosterMulti(data.selectedBoosterMulti);
        if (data.selectedResult) setSelectedResult(data.selectedResult);
        if (Array.isArray(data.panelOrder)) {
          setPanelOrder(data.panelOrder.includes("wheel") ? data.panelOrder : [...data.panelOrder, "wheel"]);
        }
        if (data.panelSizes) setPanelSizes({ ...data.panelSizes, wheel: data.panelSizes.wheel || "full" });
        if (data.pinnedPanels) setPinnedPanels({ ...data.pinnedPanels, wheel: data.pinnedPanels.wheel ?? true });
        if (data.swapA) setSwapA(data.swapA);
        if (data.swapB) setSwapB(data.swapB);
        if (typeof data.bankrollStart === "number") setBankrollStart(data.bankrollStart);
        if (data.betAmounts) setBetAmounts(data.betAmounts);
        if (data.betSnapshots) setBetSnapshots(data.betSnapshots);
        if (typeof data.strategyActive === "boolean") setStrategyActive(data.strategyActive);
        if (data.strategyMultiplier !== undefined) setStrategyMultiplier(Number(data.strategyMultiplier) || 2.2);
        if (data.strategySteps) setStrategySteps(data.strategySteps);
        if (data.strategyLossCounters) setStrategyLossCounters(data.strategyLossCounters);
        if (typeof data.simulationActive === "boolean") setSimulationActive(data.simulationActive);
        if (data.simulationStartTime !== undefined) setSimulationStartTime(data.simulationStartTime);
        if (typeof data.simulationBaseLength === "number") setSimulationBaseLength(data.simulationBaseLength);
        if (Array.isArray(data.simulationRanges)) setSimulationRanges(data.simulationRanges);
        if (data.simulationStartFrom !== undefined) setSimulationStartFrom(data.simulationStartFrom);
        if (data.excludedSimulationRows) setExcludedSimulationRows(data.excludedSimulationRows);
        if (Array.isArray(data.pausedSimulationRows)) setPausedSimulationRows(data.pausedSimulationRows);
        if (data.lastPausedLength !== undefined) setLastPausedLength(data.lastPausedLength);
        if (data.collapsedPanels) setCollapsedPanels({ ...data.collapsedPanels, wheel: data.collapsedPanels.wheel ?? false });
        if (data.selectedWheelId) setSelectedWheelId(data.selectedWheelId);
      }
    } catch (error) {
      console.warn("Impossible de charger les données sauvegardées", error);
    } finally {
      setStorageReady(true);
    }
  }, []);

  useEffect(() => {
    if (!storageReady) return;

    const payload = {
      history,
      boosters,
      rawGames,
      importStatus,
      liveMode,
      range,
      selectedBoosterSymbol,
      selectedBoosterMulti,
      selectedResult,
      panelOrder,
      panelSizes,
      pinnedPanels,
      swapA,
      swapB,
      bankrollStart,
      betAmounts,
      betSnapshots,
      strategyActive,
      strategyMultiplier,
      strategySteps,
      strategyLossCounters,
      simulationActive,
      simulationStartTime,
      simulationBaseLength,
      simulationRanges,
      simulationStartFrom,
      excludedSimulationRows,
      pausedSimulationRows,
      lastPausedLength,
      collapsedPanels,
      selectedWheelId,
    };

    localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
  }, [
    storageReady,
    history,
    boosters,
    rawGames,
    importStatus,
    liveMode,
    range,
    selectedBoosterSymbol,
    selectedBoosterMulti,
    selectedResult,
    panelOrder,
    panelSizes,
    pinnedPanels,
    swapA,
    swapB,
    bankrollStart,
    betAmounts,
    betSnapshots,
    strategyActive,
    strategyMultiplier,
    strategySteps,
    strategyLossCounters,
    simulationActive,
    simulationStartTime,
    simulationBaseLength,
    simulationRanges,
    simulationStartFrom,
    excludedSimulationRows,
    pausedSimulationRows,
    lastPausedLength,
    collapsedPanels,
    selectedWheelId,
  ]);

  const resetBasicData = () => {
    setHistory([]);
    setBoosters([]);
    setRawGames([]);
    setImportStatus("Données de jeu réinitialisées");
    setSimulationActive(false);
    setSimulationStartTime(null);
    setSimulationBaseLength(0);
    setSimulationRanges([]);
    setSimulationStartFrom(0);
    setExcludedSimulationRows({});
    setPausedSimulationRows([]);
    setBetSnapshots({});
    setStrategyActive(false);
    setStrategyMultiplier(2.2);
    setStrategySteps({
      "1": 1,
      "2": 2,
      "5": 5,
      "10": 10,
      loot: 5,
      marbles: 10,
      map: 10,
      treasure: 20,
    });
    setStrategyLossCounters({
      "1": 0,
      "2": 0,
      "5": 0,
      "10": 0,
      loot: 0,
      marbles: 0,
      map: 0,
      treasure: 0,
    });
    setEditingSimulationRowId(null);
    setEditingBetAmounts(null);
  };

  const resetFullApp = () => {
    localStorage.removeItem(STORAGE_KEY);
    window.location.reload();
  };

  const togglePanel = (panel) => setCollapsedPanels((prev) => ({ ...prev, [panel]: !prev[panel] }));
  const togglePanelSize = (panel) => {
    setPanelSizes((prev) => ({
      ...prev,
      [panel]: prev[panel] === "full" ? "half" : "full",
    }));
  };
  const togglePinnedPanel = (panel) => {
    setPinnedPanels((prev) => ({ ...prev, [panel]: !prev[panel] }));
  };
  const panelLabels = {
    quick: "Résultats manuels des tours",
    recent: "Tours récents",
    segments: "Tableau probabilités et retards",
    boosters: "Tracking booster",
    simulator: "Simulation de session",
    wheel: "Roue interactive",
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

    if (simulationActive) {
      applyStrategyAfterResult(selectedResult, betSnapshotAtSpin);
    }
  };

  const undoLastSpin = () => {
    setHistory((h) => h.slice(0, -1));
    setBoosters((b) => b.slice(0, -1));
    setRawGames((games) => games.slice(0, -1));
  };

  const deleteSpecificSpin = (gameId, indexToDelete) => {
    setHistory((prev) => prev.filter((_, index) => index !== indexToDelete));
    setBoosters((prev) => prev.filter((_, index) => index !== indexToDelete));

    setRawGames((prev) => {
      if (!prev.length) return prev;
      return prev.filter((game, index) => {
        if (gameId) {
          return game.gameId !== gameId;
        }
        return index !== indexToDelete;
      });
    });
  };

  const exportStrategyData = () => {
    const payload = {
      description: "Treasure Island Strategy Export",
      exportedAt: new Date().toISOString(),
      strategy: {
        strategyActive,
        strategyMultiplier,
        strategySteps,
        strategyLossCounters,
        betAmounts,
      },
    };

    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `treasure_strategy_${new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-")}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleStrategyUpload = (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      try {
        const payload = JSON.parse(String(reader.result));
        const strategy = payload.strategy || payload;

        if (typeof strategy.strategyActive === "boolean") setStrategyActive(strategy.strategyActive);
        if (strategy.strategyMultiplier !== undefined) setStrategyMultiplier(strategy.strategyMultiplier);
        if (strategy.strategySteps) setStrategySteps(strategy.strategySteps);
        if (strategy.strategyLossCounters) setStrategyLossCounters(strategy.strategyLossCounters);
        if (strategy.betAmounts) setBetAmounts(strategy.betAmounts);

        setImportStatus("Stratégie importée avec succès");
      } catch (error) {
        setImportStatus("Erreur : stratégie invalide");
      }
    };

    reader.readAsText(file);
    event.target.value = "";
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
          const previousKeys = new Set(
            previousGames.map((game, index) => game.gameId || `${game.gameStart || 0}-${game.gameResult || game.rc}-${index}`)
          );

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

          const addedGames = mergedGames
            .map((game, index) => ({ game, index, key: game.gameId || `${game.gameStart || 0}-${game.gameResult || game.rc}-${index}` }))
            .filter((entry) => !previousKeys.has(entry.key));

          if (simulationActive && addedGames.length) {
            let rollingBets = { ...betAmounts };
            let rollingCounters = { ...strategyLossCounters };
            const snapshotsToAdd = {};

            [...addedGames]
              .sort((a, b) => a.index - b.index)
              .forEach(({ game, index }) => {
                const resultId = RESULT_TO_ID[game.gameResult] || BET_CODE_TO_ID[game.rc] || String(game.gameResult);
                snapshotsToAdd[index] = { ...rollingBets };

                const strategyResult = applyStrategyToRollingBets(resultId, rollingBets, rollingCounters);
                rollingBets = strategyResult.bets;
                rollingCounters = strategyResult.counters;
              });

            setBetSnapshots((previousSnapshots) => ({ ...previousSnapshots, ...snapshotsToAdd }));
            setStrategyLossCounters(rollingCounters);
            if (strategyActive) {
              setBetAmounts(rollingBets);
            }
          }

          const addedCount = addedGames.length;
          setImportStatus(`${addedCount} nouveaux tours ajoutés · ${mergedGames.length} tours au total`);
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
      action={<><Button onClick={() => togglePinnedPanel("quick")} className={`rounded-xl border border-white/10 ${pinnedPanels.quick ? "bg-amber-400 text-black" : "bg-black/25 hover:bg-white/15"}`}>📌</Button><Button onClick={() => togglePanelSize("quick")} className="rounded-xl border border-white/10 bg-black/25 hover:bg-white/15">{panelSizes.quick === "full" ? "½" : "↔"}</Button></>}
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
      action={<><Button onClick={() => togglePinnedPanel("recent")} className={`rounded-xl border border-white/10 ${pinnedPanels.recent ? "bg-amber-400 text-black" : "bg-black/25 hover:bg-white/15"}`}>📌</Button><Button onClick={() => togglePanelSize("recent")} className="rounded-xl border border-white/10 bg-black/25 hover:bg-white/15">{panelSizes.recent === "full" ? "½" : "↔"}</Button></>}
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

              <div className="flex flex-col items-end gap-2">
                <button
                  onClick={() => deleteSpecificSpin(game.gameId, recentGames.length - 1 - index)}
                  className="rounded-xl bg-red-500/20 px-3 py-2 text-xs font-black text-red-200 transition hover:bg-red-500/30"
                >
                  Supprimer
                </button>

                <div className={`min-w-[110px] rounded-2xl px-4 py-4 text-center text-2xl font-black shadow-inner ${boosterHits ? "bg-emerald-500/20 text-emerald-300" : "bg-white/10 text-slate-200"}`}>

                {(resultId === "map" || resultId === "treasure") && (game.minMul || game.maxMul)
                  ? `x${game.minMul || "?"}${game.maxMul ? ` - x${game.maxMul}` : ""}`
                  : `x${game.finalMul || game.payoutMul || 1}`}
              </div>
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
      action={<><Button onClick={() => togglePinnedPanel("segments")} className={`rounded-xl border border-white/10 ${pinnedPanels.segments ? "bg-amber-400 text-black" : "bg-black/25 hover:bg-white/15"}`}>📌</Button><Button onClick={() => togglePanelSize("segments")} className="rounded-xl border border-white/10 bg-black/25 hover:bg-white/15">{panelSizes.segments === "full" ? "½" : "↔"}</Button></>}
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
      action={<><Button onClick={() => togglePinnedPanel("boosters")} className={`rounded-xl border border-white/10 ${pinnedPanels.boosters ? "bg-amber-400 text-black" : "bg-black/25 hover:bg-white/15"}`}>📌</Button><Button onClick={() => togglePanelSize("boosters")} className="rounded-xl border border-white/10 bg-black/25 hover:bg-white/15">{panelSizes.boosters === "full" ? "½" : "↔"}</Button></>}
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
    const cleaned = normalizeDecimalInput(value);
    if (cleaned === "") {
      setBetAmounts((prev) => ({ ...prev, [id]: "" }));
      return;
    }
    if (!isValidDecimalInput(cleaned)) return;

    const max = BET_LIMITS_BY_ID[id] ?? 1000;
    const numeric = Number(cleaned);
    if (Number.isFinite(numeric) && numeric > max) {
      setBetAmounts((prev) => ({ ...prev, [id]: max }));
      return;
    }

    setBetAmounts((prev) => ({ ...prev, [id]: cleaned }));
  };

  const commitBetAmount = (id) => {
    setBetAmounts((prev) => {
      const value = prev[id];
      if (value === "" || value === ".") return { ...prev, [id]: 0 };
      return { ...prev, [id]: roundToTenth(clampBetAmount(id, value)) };
    });
  };

  const getCurrentBetSnapshot = () => ({ ...betAmounts });

  const updateStrategyStep = (id, value) => {
    const cleaned = String(value ?? "");

    if (cleaned === "") {
      setStrategySteps((prev) => ({
        ...prev,
        [id]: "",
      }));
      return;
    }

    if (!/^[0-9]*$/.test(cleaned)) return;

    setStrategySteps((prev) => ({
      ...prev,
      [id]: cleaned,
    }));
  };

  const commitStrategyStep = (id) => {
    setStrategySteps((prev) => ({
      ...prev,
      [id]: Math.max(1, Math.round(Number(prev[id]) || 1)),
    }));
  };

  const applyStrategyAfterResult = (resultId, snapshot) => {
    if (!strategyActive) return;

    const result = applyStrategyToRollingBets(resultId, snapshot, strategyLossCounters);
    setBetAmounts(result.bets);
    setStrategyLossCounters(result.counters);
  };

  const recalculateSessionStrategy = () => {
    if (!simulationRows.length) return;

    const orderedRows = [...simulationRows].sort((a, b) => a.sourceIndex - b.sourceIndex);
    let rollingBets = { ...betAmounts };
    let rollingCounters = {
      "1": 0,
      "2": 0,
      "5": 0,
      "10": 0,
      loot: 0,
      marbles: 0,
      map: 0,
      treasure: 0,
    };
    const snapshots = {};

    orderedRows.forEach((row) => {
      snapshots[row.sourceIndex] = { ...rollingBets };
      const result = applyStrategyToRollingBets(row.result, rollingBets, rollingCounters);
      rollingBets = result.bets;
      rollingCounters = result.counters;
    });

    setBetSnapshots((prev) => ({ ...prev, ...snapshots }));
    setBetAmounts(rollingBets);
    setStrategyLossCounters(rollingCounters);
  };

  const applyStrategyToRollingBets = (resultId, rollingBets, rollingCounters) => {
    if (!strategyActive) return { bets: rollingBets, counters: rollingCounters };

    const multiplier = Math.max(1, Number(strategyMultiplier) || 1);
    const nextBets = { ...rollingBets };
    const nextCounters = { ...rollingCounters };

    SYMBOLS.forEach((symbol) => {
      const amountPlayed = Number(rollingBets[symbol.id] || 0);
      if (amountPlayed <= 0) return;

      if (symbol.id === resultId) {
        nextCounters[symbol.id] = 0;
        nextBets[symbol.id] = roundAndClampBetAmount(symbol.id, betAmounts[symbol.id] || rollingBets[symbol.id] || 0);
        return;
      }

      const newLossCount = (Number(nextCounters[symbol.id]) || 0) + 1;
      const step = Math.max(1, Number(strategySteps[symbol.id]) || 1);
      nextCounters[symbol.id] = newLossCount;

      if (newLossCount % step === 0) {
        nextBets[symbol.id] = roundAndClampBetAmount(symbol.id, amountPlayed * multiplier);
      }
    });

    return { bets: nextBets, counters: nextCounters };
  };

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
    const cleaned = normalizeDecimalInput(value);
    if (cleaned === "") {
      setEditingBetAmounts((prev) => ({ ...(prev || {}), [id]: "" }));
      return;
    }
    if (!isValidDecimalInput(cleaned)) return;

    const max = BET_LIMITS_BY_ID[id] ?? 1000;
    const numeric = Number(cleaned);
    if (Number.isFinite(numeric) && numeric > max) {
      setEditingBetAmounts((prev) => ({ ...(prev || {}), [id]: max }));
      return;
    }

    setEditingBetAmounts((prev) => ({
      ...(prev || {}),
      [id]: cleaned,
    }));
  };

  const commitEditingBetAmount = (id) => {
    setEditingBetAmounts((prev) => {
      const current = prev || {};
      const value = current[id];
      if (value === "" || value === ".") return { ...current, [id]: 0 };
      return { ...current, [id]: roundToTenth(clampBetAmount(id, value)) };
    });
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
        const totalReturnMultiplier = payout > 0 ? payout + 1 : 0;
        const win = betOnResult * totalReturnMultiplier;
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

    let runningBankroll = bankrollStart;
    let minBankroll = bankrollStart;
    let maxBankroll = bankrollStart;
    let biggestStake = 0;

    includedSimulationRows.forEach((row) => {
      runningBankroll += row.profit;
      minBankroll = Math.min(minBankroll, runningBankroll);
      maxBankroll = Math.max(maxBankroll, runningBankroll);
      biggestStake = Math.max(biggestStake, row.totalStake);
    });

    return {
      stake,
      win,
      profit,
      bankroll: bankrollStart + profit,
      minBankroll,
      maxBankroll,
      biggestStake,
    };
  }, [includedSimulationRows, bankrollStart]);

  const simulatorPanel = (
    <Panel
      title="Simulation de session"
      subtitle="Comme si tu jouais directement sur le jeu"
      collapsed={collapsedPanels.simulator}
      onToggle={() => togglePanel("simulator")}
      action={<><Button onClick={() => togglePinnedPanel("simulator")} className={`rounded-xl border border-white/10 ${pinnedPanels.simulator ? "bg-amber-400 text-black" : "bg-black/25 hover:bg-white/15"}`}>📌</Button><Button onClick={() => togglePanelSize("simulator")} className="rounded-xl border border-white/10 bg-black/25 hover:bg-white/15">{panelSizes.simulator === "full" ? "½" : "↔"}</Button></>}
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
                <div key={s.id} className="grid grid-cols-[72px_1fr] gap-3 rounded-xl bg-white/5 px-3 py-3">
                  <ResultToken value={s.id} />

                  <div className="min-w-0 space-y-2">
                    <span className="block text-sm font-bold leading-tight">{s.short || s.label}</span>

                    <div className="grid grid-cols-[32px_36px_minmax(0,1fr)_42px] items-center gap-1">
                    <button
                      onClick={() => updateBetAmount(s.id, 0)}
                      className="h-9 rounded-lg bg-red-500/20 px-2 text-xs font-black text-red-200 hover:bg-red-500/30"
                    >
                      0
                    </button>

                    <button
                      onClick={() => updateBetAmount(s.id, Math.max(0.1, Number(betAmounts[s.id] || 0) / 2))}
                      className="h-9 rounded-lg bg-white/10 px-2 text-xs font-black text-slate-200 hover:bg-white/20"
                    >
                      /2
                    </button>

                    <input
                      type="text"
                      inputMode="decimal"
                      value={betAmounts[s.id] === 0 ? "" : betAmounts[s.id]}
                      onChange={(e) => updateBetAmount(s.id, e.target.value)}
                      onBlur={() => commitBetAmount(s.id)}
                      placeholder="0"
                      className="h-9 w-full min-w-0 rounded-xl border border-white/10 bg-black/40 px-3 text-right text-sm font-black text-white outline-none placeholder:text-slate-500 focus:border-amber-300"
                    />

                    <button
                      onClick={() => updateBetAmount(s.id, roundAndClampBetAmount(s.id, Number(betAmounts[s.id] || 0) * 2 || 1))}
                      className="h-9 rounded-lg bg-amber-400/20 px-2 text-xs font-black text-amber-200 hover:bg-amber-400/30"
                    >
                      x2
                    </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="mt-4 rounded-2xl border border-amber-300/20 bg-amber-400/10 p-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-black text-amber-200">Stratégie automatique</p>
                  <p className="text-xs text-slate-400">Multiplie les mises perdantes selon une fréquence propre à chaque issue.</p>
                </div>

                <div className="flex flex-wrap gap-2">
                  <button
                    onClick={() => setStrategyActive((value) => !value)}
                    className={`rounded-xl px-4 py-2 text-sm font-black transition ${strategyActive ? "bg-emerald-500 text-black" : "bg-white/10 text-slate-300 hover:bg-white/20"}`}
                  >
                    {strategyActive ? "Activée" : "Désactivée"}
                  </button>

                  <button
                    onClick={recalculateSessionStrategy}
                    className="rounded-xl bg-amber-400/20 px-4 py-2 text-sm font-black text-amber-200 transition hover:bg-amber-400/30"
                  >
                    Recalculer
                  </button>
                </div>
              </div>

              <div className="mt-3 grid gap-2 sm:grid-cols-[1fr_auto] sm:items-center">
                <label className="text-xs font-bold text-slate-300">Multiplicateur après perte</label>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-black text-slate-400">x</span>
                  <input
                    type="text"
                    inputMode="decimal"
                    value={strategyMultiplier}
                    onChange={(e) => setStrategyMultiplier(e.target.value.replace(",", "."))}
                    className="w-24 rounded-xl border border-white/10 bg-black/40 px-3 py-2 text-right font-black text-white outline-none focus:border-amber-300"
                    placeholder="2.2"
                  />
                </div>
              </div>

              <p className="mt-3 text-xs text-slate-500">
                Exemple : le 1 augmente toutes les pertes, le 2 toutes les 2 pertes, le 10 toutes les 10 pertes.
              </p>

              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                {SYMBOLS.map((s) => (
                  <div
                    key={s.id}
                    className="rounded-2xl border border-white/10 bg-black/35 p-3"
                  >
                    <div className="mb-2 min-w-0">
                      <p className="text-sm font-black leading-tight text-white">{s.short || s.label}</p>
                      <p className="mt-0.5 text-[10px] leading-tight text-slate-500">Toutes les {strategySteps[s.id]} pertes</p>
                    </div>

                    <div className="grid grid-cols-[36px_1fr_36px] items-center gap-2">
                      <button
                        onClick={() => updateStrategyStep(s.id, Math.max(1, Number(strategySteps[s.id]) - 1))}
                        className="flex h-9 w-9 items-center justify-center rounded-xl border border-white/10 bg-black/40 text-base font-black text-amber-200 transition hover:border-amber-300 hover:bg-amber-400/10"
                      >
                        −
                      </button>

                      <input
                        type="text"
                        inputMode="numeric"
                        value={strategySteps[s.id]}
                        onChange={(e) => updateStrategyStep(s.id, e.target.value)}
                        onBlur={() => commitStrategyStep(s.id)}
                        className="w-full rounded-xl border border-amber-300/30 bg-gradient-to-b from-black/70 to-black/30 px-2 py-2 text-center text-base font-black text-amber-200 shadow-inner shadow-black/40 outline-none transition focus:border-amber-300 focus:shadow-[0_0_20px_rgba(251,191,36,0.2)] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                      />

                      <button
                        onClick={() => updateStrategyStep(s.id, Number(strategySteps[s.id]) + 1)}
                        className="flex h-9 w-9 items-center justify-center rounded-xl border border-white/10 bg-black/40 text-base font-black text-emerald-200 transition hover:border-emerald-300 hover:bg-emerald-400/10"
                      >
                        +
                      </button>
                    </div>
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

        <div className="flex max-h-[1450px] flex-col rounded-2xl border border-white/10 bg-black/25 p-4">
          <div className="space-y-4">
            <div>
              <p className="mb-2 text-xs font-black uppercase tracking-wide text-slate-500">Données actuelles</p>
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                <div className="rounded-2xl bg-black/25 p-4"><p className="text-xs text-slate-400">Mises totales</p><p className="text-2xl font-black">€{simulationTotal.stake.toFixed(2)}</p></div>
                <div className="rounded-2xl bg-black/25 p-4"><p className="text-xs text-slate-400">Gains totaux</p><p className="text-2xl font-black text-emerald-300">€{simulationTotal.win.toFixed(2)}</p></div>
                <div className="rounded-2xl bg-black/25 p-4"><p className="text-xs text-slate-400">Profit</p><p className={`text-2xl font-black ${simulationTotal.profit > 0 ? "text-emerald-300" : simulationTotal.profit < 0 ? "text-red-300" : "text-slate-300"}`}>{simulationTotal.profit >= 0 ? "+" : ""}€{simulationTotal.profit.toFixed(2)}</p></div>
              </div>
            </div>

            <div>
              <p className="mb-2 text-xs font-black uppercase tracking-wide text-slate-500">Données sur toute la session</p>
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                <div className="rounded-2xl bg-red-950/20 p-4"><p className="text-xs text-slate-400">Bankroll min</p><p className="text-2xl font-black text-red-300">€{simulationTotal.minBankroll.toFixed(2)}</p></div>
                <div className="rounded-2xl bg-emerald-950/20 p-4"><p className="text-xs text-slate-400">Bankroll max</p><p className="text-2xl font-black text-emerald-300">€{simulationTotal.maxBankroll.toFixed(2)}</p></div>
                <div className="rounded-2xl bg-amber-950/20 p-4"><p className="text-xs text-slate-400">Plus grosse mise</p><p className="text-2xl font-black text-amber-200">€{simulationTotal.biggestStake.toFixed(2)}</p></div>
              </div>
            </div>
          </div>

          <div className="mb-3 mt-4 flex items-center justify-between">
            <div>
              <h3 className="text-lg font-black">Tours pris en compte</h3>
              <p className="text-sm text-slate-400">{includedSimulationRows.length}/{simulationRows.length} tours pris en compte</p>
            </div>
          </div>

          <div className="mt-2 space-y-2 overflow-y-auto pr-1">
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
                            <div className="mt-1 flex items-center gap-1">
                              <button
                                onClick={() => updateEditingBetAmount(s.id, 0)}
                                className="rounded-lg bg-red-500/20 px-2 py-2 text-[10px] font-black text-red-200 hover:bg-red-500/30"
                              >
                                0
                              </button>

                              <button
                                onClick={() => updateEditingBetAmount(s.id, Math.max(0.1, Number(editingBetAmounts?.[s.id] || 0) / 2))}
                                className="rounded-lg bg-white/10 px-2 py-2 text-[10px] font-black text-slate-200 hover:bg-white/20"
                              >
                                /2
                              </button>

                              <input
                                type="text"
                                inputMode="decimal"
                                value={editingBetAmounts?.[s.id] === 0 ? "" : editingBetAmounts?.[s.id] ?? ""}
                                onChange={(e) => updateEditingBetAmount(s.id, e.target.value)}
                                onBlur={() => commitEditingBetAmount(s.id)}
                                placeholder="0"
                                className="w-full min-w-0 flex-1 rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-right font-black text-white outline-none placeholder:text-slate-500 focus:border-amber-300"
                              />

                              <button
                                onClick={() => updateEditingBetAmount(s.id, roundAndClampBetAmount(s.id, Number(editingBetAmounts?.[s.id] || 0) * 2 || 1))}
                                className="rounded-lg bg-amber-400/20 px-2 py-2 text-[10px] font-black text-amber-200 hover:bg-amber-400/30"
                              >
                                x2
                              </button>
                            </div>
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

  const wheelSegments = [
    "treasure", "1", "2", "5", "2", "1",
    "loot", "1", "10", "5", "1", "2",
    "marbles", "1", "2", "5", "2", "1",
    "map", "1", "2", "10", "5", "1",
    "loot", "1", "2", "5", "2", "1",
    "loot", "1", "2", "10", "2", "1",
    "map", "1", "2", "5", "2", "1",
    "marbles", "1", "2", "5", "2", "1",
    "loot", "1", "10", "5", "2", "1",
  ];

  const wheelPanel = (
    <Panel
      title="Roue interactive"
      subtitle="Simulation visuelle des 54 segments"
      collapsed={collapsedPanels.wheel}
      onToggle={() => togglePanel("wheel")}
      action={<><Button onClick={() => togglePinnedPanel("wheel")} className={`rounded-xl border border-white/10 ${pinnedPanels.wheel ? "bg-amber-400 text-black" : "bg-black/25 hover:bg-white/15"}`}>📌</Button><Button onClick={() => togglePanelSize("wheel")} className="rounded-xl border border-white/10 bg-black/25 hover:bg-white/15">{panelSizes.wheel === "full" ? "½" : "↔"}</Button></>}
    >
      <div className="grid gap-6 lg:grid-cols-[420px_1fr] lg:items-center">
        <div className="relative mx-auto aspect-square w-full max-w-[520px] rounded-full border-[10px] border-[#5b3a1d] bg-[#1b1008] p-3 shadow-[0_0_70px_rgba(251,191,36,0.16)]">
          <svg viewBox="0 0 100 100" className="h-full w-full overflow-visible">
            <defs>
              <radialGradient id="wheelWood" cx="50%" cy="50%" r="55%">
                <stop offset="0%" stopColor="#f6d59b" />
                <stop offset="55%" stopColor="#d3a866" />
                <stop offset="100%" stopColor="#8b5a2b" />
              </radialGradient>
              <filter id="softShadow" x="-20%" y="-20%" width="140%" height="140%">
                <feDropShadow dx="0" dy="2" stdDeviation="1.2" floodColor="#000" floodOpacity="0.55" />
              </filter>
            </defs>

            <circle cx="50" cy="50" r="47" fill="url(#wheelWood)" stroke="#2b1a0d" strokeWidth="2" />
            <circle cx="50" cy="50" r="39" fill="none" stroke="rgba(80,45,20,0.35)" strokeWidth="0.8" />
            <circle cx="50" cy="50" r="47" fill="none" stroke="#c99a48" strokeWidth="1.1" />

            {wheelSegments.map((id, index) => {
              const angle = (index / wheelSegments.length) * 360 - 90;
              const nextAngle = ((index + 1) / wheelSegments.length) * 360 - 90;
              const mid = (angle + nextAngle) / 2;
              const rad = (Math.PI / 180) * mid;
              const symbol = SYMBOLS.find((s) => s.id === id);
              const fill = {
                "1": "#d79622",
                "2": "#15803d",
                "5": "#0e7490",
                "10": "#b91c1c",
                loot: "#166534",
                marbles: "#1d4ed8",
                map: "#c2410c",
                treasure: "#9f1239",
              }[id];

              const isBonus = BONUS_IDS.includes(id);
              const placementRadius = isBonus ? 31 : 40;
              const x = 50 + placementRadius * Math.cos(rad);
              const y = 50 + placementRadius * Math.sin(rad);
              const label = isBonus ? (symbol?.short || id).toUpperCase() : id;

              return (
                <g key={`${id}-${index}`} onClick={() => setSelectedWheelId(id)} className="cursor-pointer">
                  {isBonus ? (
                    <g transform={`translate(${x} ${y})`}>
                      <rect x="-6" y="-2" width="12" height="4" rx="1" fill={fill} stroke="#f5d38b" strokeWidth="0.35" filter="url(#softShadow)" opacity={selectedWheelId === id ? 1 : 0.92} />
                      <text textAnchor="middle" dominantBaseline="middle" fontSize="1.25" fontWeight="900" fill="#fff7d6" stroke="rgba(0,0,0,0.75)" strokeWidth="0.25" paintOrder="stroke">
                        {label}
                      </text>
                    </g>
                  ) : (
                    <g transform={`translate(${x} ${y})`}>
                      <circle r="2.65" fill={fill} stroke={selectedWheelId === id ? "#fde68a" : "#2b1a0d"} strokeWidth={selectedWheelId === id ? "0.75" : "0.35"} filter="url(#softShadow)" opacity={selectedWheelId === id ? 1 : 0.95} />
                      <text textAnchor="middle" dominantBaseline="middle" fontSize={id === "10" ? "2.25" : "2.75"} fontWeight="900" fill="#fff7d6" stroke="rgba(0,0,0,0.72)" strokeWidth="0.25" paintOrder="stroke">
                        {id}
                      </text>
                    </g>
                  )}
                </g>
              );
            })}

            {wheelSegments.map((_, index) => {
              const angle = (index / wheelSegments.length) * 360 - 90;
              const rad = (Math.PI / 180) * angle;
              const x1 = 50 + 10 * Math.cos(rad);
              const y1 = 50 + 10 * Math.sin(rad);
              const x2 = 50 + 36 * Math.cos(rad);
              const y2 = 50 + 36 * Math.sin(rad);
              return <line key={`spoke-${index}`} x1={x1} y1={y1} x2={x2} y2={y2} stroke="rgba(80,45,20,0.18)" strokeWidth="0.35" />;
            })}

            <circle cx="50" cy="50" r="14" fill="#10202a" stroke="#f59e0b" strokeWidth="1.2" filter="url(#softShadow)" />
            <text x="50" y="47.8" textAnchor="middle" fontSize="4.2" fontWeight="900" fill="#fef3c7" stroke="#3a210b" strokeWidth="0.45" paintOrder="stroke">TREASURE</text>
            <text x="50" y="53.2" textAnchor="middle" fontSize="4.2" fontWeight="900" fill="#fef3c7" stroke="#3a210b" strokeWidth="0.45" paintOrder="stroke">ISLAND</text>
          </svg>
        </div>

        <div className="space-y-4">
          <div className="rounded-2xl border border-white/10 bg-black/25 p-4">
            <p className="text-xs font-black uppercase tracking-wide text-slate-400">Segment sélectionné</p>
            <div className="mt-3 flex items-center gap-3">
              <ResultToken value={selectedWheelId} size="lg" />
              <div>
                <p className="text-2xl font-black text-white">{SYMBOLS.find((s) => s.id === selectedWheelId)?.short || selectedWheelId}</p>
                <p className="text-sm text-slate-400">{SYMBOLS.find((s) => s.id === selectedWheelId)?.segments} segments sur 54 · {SYMBOLS.find((s) => s.id === selectedWheelId)?.expected.toFixed(2)}%</p>
              </div>
            </div>
          </div>

          <div className="grid gap-2 sm:grid-cols-2">
            {SYMBOLS.map((s) => (
              <button
                key={s.id}
                onClick={() => setSelectedWheelId(s.id)}
                className={`rounded-2xl border p-3 text-left transition ${selectedWheelId === s.id ? "border-amber-300 bg-amber-300/15" : "border-white/10 bg-black/25 hover:bg-white/10"}`}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="font-black text-white">{s.short || s.label}</span>
                  <span className="text-xs font-bold text-slate-400">{s.segments}/54</span>
                </div>
                <div className="mt-2 h-2 overflow-hidden rounded-full bg-black/40">
                  <div className="h-full rounded-full bg-amber-300" style={{ width: `${s.expected}%` }} />
                </div>
              </button>
            ))}
          </div>
        </div>
      </div>
    </Panel>
  );

  const panels = { quick: quickPanel, recent: recentPanel, segments: segmentsPanel, boosters: boostersPanel, simulator: simulatorPanel, wheel: wheelPanel };
  const openPanelIds = panelOrder.filter((id) => !collapsedPanels[id]);
  const collapsedPanelIds = panelOrder.filter((id) => collapsedPanels[id]);

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_20%_0%,#1d5b67_0%,transparent_36%),radial-gradient(circle_at_80%_10%,#7a4b18_0%,transparent_30%),linear-gradient(135deg,#031018_0%,#07131c_46%,#020611_100%)] px-3 py-4 text-white sm:p-6">
      <div className="pointer-events-none fixed inset-0 opacity-30 [background-image:linear-gradient(rgba(255,255,255,0.04)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.04)_1px,transparent_1px)] [background-size:48px_48px]" />
      <div className="relative mx-auto max-w-7xl space-y-4 sm:space-y-6">
        <header className="rounded-[1.5rem] border border-white/10 bg-[#071927]/75 p-4 shadow-[0_25px_80px_rgba(0,0,0,0.55)] backdrop-blur-xl sm:rounded-[2rem] sm:p-6">
          <div className="grid gap-4 lg:grid-cols-[1fr_260px] lg:items-center">
            <div>
              <div className="mb-2 flex items-center gap-2 text-sm text-slate-300">
                <span className={`h-2.5 w-2.5 rounded-full ${liveMode ? "bg-red-500 animate-pulse" : "bg-slate-500"}`} />
                {liveMode ? "Lecture live active" : "Lecture live en pause"}
              </div>
              <div className="flex items-center gap-3">
                <div className="rounded-2xl border border-amber-300/30 bg-amber-400/20 p-3 shadow-[0_0_35px_rgba(251,191,36,0.25)]"><Anchor className="h-7 w-7 text-amber-300" /></div>
                <div><h1 className="bg-gradient-to-r from-amber-200 via-yellow-400 to-orange-300 bg-clip-text text-3xl font-black tracking-tight text-transparent sm:text-5xl">Treasure Island</h1><p className="text-xs font-semibold text-slate-300 sm:text-sm">Tracker live · historique · boosters · JSON Pragmatic</p></div>
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

              <div className="grid grid-cols-2 gap-2">
                <label className="block cursor-pointer rounded-xl bg-purple-500/20 px-3 py-3 text-center text-xs font-black text-purple-100 transition hover:bg-purple-500/30">
                  Import stratégie
                  <input type="file" accept="application/json,.json" onChange={handleStrategyUpload} className="hidden" />
                </label>

                <Button onClick={exportStrategyData} className="rounded-xl bg-purple-500/20 px-3 py-3 text-xs font-black text-purple-100 hover:bg-purple-500/30">
                  Export stratégie
                </Button>
              </div>
              <Button onClick={resetBasicData} className="w-full rounded-xl bg-white/10 py-3 font-black text-white hover:bg-white/20">
                Reset données
              </Button>
              <Button onClick={resetFullApp} className="w-full rounded-xl bg-red-500/20 py-3 font-black text-red-200 hover:bg-red-500/30">
                Reset app
              </Button>
              <div className="rounded-2xl bg-black/25 px-4 py-3"><p className="text-xs text-slate-400">Import</p><p className="text-sm font-bold text-slate-200">{importStatus}</p></div>
            </div>
          </div>
        </header>

        <section className="grid gap-3 rounded-[1.5rem] border border-white/10 bg-[#071927]/75 p-3 shadow-xl backdrop-blur-xl sm:p-4 lg:grid-cols-[1fr_auto] lg:items-center">
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
          <main className="grid auto-rows-max grid-cols-1 gap-4 sm:gap-6 lg:grid-cols-12">
            {openPanelIds.map((id) => {
              const isHalf = panelSizes[id] === "half";

              return (
                <motion.div
                  layout
                  key={id}
                  drag={!pinnedPanels[id]}
                  dragMomentum={false}
                  dragElastic={0.08}
                  whileDrag={{ scale: 1.02, zIndex: 50 }}
                  className={isHalf ? "lg:col-span-6" : "lg:col-span-12"}
                >
                  <div className="relative">
                    <div className={`absolute -top-2 left-1/2 z-10 h-1.5 w-24 -translate-x-1/2 rounded-full ${pinnedPanels[id] ? "bg-amber-300/60" : "bg-white/10"}`} />
                    {panels[id]}
                  </div>
                </motion.div>
              );
            })}
          </main>

          {collapsedPanelIds.length > 0 && (
            <motion.aside
              drag
              dragMomentum={false}
              dragElastic={0.08}
              whileDrag={{ scale: 1.02 }}
              initial={{ x: 0, y: 0 }}
              className="absolute left-0 top-0 z-40 flex max-h-[80vh] w-[260px] flex-col gap-3 overflow-y-auto rounded-[1.5rem] border border-white/10 bg-[#07131c]/95 p-4 shadow-2xl backdrop-blur-xl"
            >
              <div className="mb-1 flex items-center justify-between">
                <p className="text-xs font-black uppercase tracking-wide text-slate-400">Pages réduites</p>
                <div className="h-1.5 w-14 rounded-full bg-white/10" />
              </div>

              {collapsedPanelIds.map((id) => (
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  key={id}
                  onClick={() => togglePanel(id)}
                  className="w-full cursor-grab rounded-2xl border border-white/10 bg-black/30 p-3 text-left active:cursor-grabbing"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="font-black text-white">{panelLabels[id]}</p>
                      <p className="text-xs text-slate-400">Cliquer pour rouvrir</p>
                    </div>

                    <div className="rounded-lg border border-amber-300/20 bg-amber-400/10 px-2 py-1 text-[10px] font-black text-amber-200">
                      ↕
                    </div>
                  </div>
                </motion.button>
              ))}
            </motion.aside>
          )}
        </div>
      </div>
    </div>
  );
}
