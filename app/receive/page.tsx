"use client";

import { FormEvent, useMemo, useRef, useState } from "react";

import DesktopSidebar from "../../src/components/layout/DesktopSidebar";
import BottomNav from "../../src/components/navigation/BottomNav";
import AppIcon from "../../src/components/ui/AppIcon";
import { PrivateAmount } from "../../src/components/ui/PrivateAmount";
import { useBanking } from "../../src/context/BankingContext";

type ReceiveMethod = "bank" | "qr" | "crypto";
type CryptoWalletId = "btc" | "eth" | "usdt" | "usdc" | "bnb";

const methods: Array<{
  id: ReceiveMethod;
  title: string;
  desc: string;
  icon: "bank" | "receive" | "crypto";
}> = [
  { id: "bank", title: "Bank Transfer", desc: "Local and international deposits", icon: "bank" },
  { id: "qr", title: "QR Payment", desc: "Instant mobile collection", icon: "receive" },
  { id: "crypto", title: "Crypto Wallet", desc: "Blockchain asset receipts", icon: "crypto" },
];

const cryptoWallets: Array<{
  id: CryptoWalletId;
  title: string;
  network: string;
  address: string;
  settlement: string;
}> = [
  {
    id: "btc",
    title: "BTC",
    network: "Bitcoin",
    address: "bc1qaurex8fd9k7m2q4p6n0s3z5c8v1x9wallet",
    settlement: "2 confirmations",
  },
  {
    id: "eth",
    title: "ETH",
    network: "Ethereum ERC20",
    address: "0xA93E47cF0b98c45f273A7e80f3b79b8A92D44F10",
    settlement: "12 confirmations",
  },
  {
    id: "usdt",
    title: "USDT",
    network: "TRC20",
    address: "TAurex7n9F8c2K6dQp4Rx5H3w1Ledger9Vault",
    settlement: "Network confirmed",
  },
  {
    id: "usdc",
    title: "USDC",
    network: "ERC20",
    address: "0xB14a4a5C97158A2E2b5D857E5a89c1fd203f4124",
    settlement: "12 confirmations",
  },
  {
    id: "bnb",
    title: "BNB",
    network: "BNB Smart Chain",
    address: "0xC7a0A7D9218cdb5a320F2F7d64c8e7cD11840e88",
    settlement: "15 blocks",
  },
];

const QR_SIZE = 33;

function money(value: number) {
  return value.toLocaleString("en-US", {
    maximumFractionDigits: 2,
    minimumFractionDigits: 2,
  });
}

function createSeed(value: string) {
  let hash = 2166136261;

  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }

  return hash >>> 0;
}

function createRandom(seed: number) {
  let state = seed || 1;

  return () => {
    state ^= state << 13;
    state ^= state >>> 17;
    state ^= state << 5;
    return (state >>> 0) / 4294967296;
  };
}

function placeFinder(matrix: boolean[][], reserved: boolean[][], row: number, col: number) {
  for (let y = -1; y <= 7; y += 1) {
    for (let x = -1; x <= 7; x += 1) {
      const nextRow = row + y;
      const nextCol = col + x;

      if (nextRow < 0 || nextCol < 0 || nextRow >= QR_SIZE || nextCol >= QR_SIZE) {
        continue;
      }

      reserved[nextRow][nextCol] = true;

      const inFinder = x >= 0 && x <= 6 && y >= 0 && y <= 6;
      const outerRing = inFinder && (x === 0 || x === 6 || y === 0 || y === 6);
      const innerSquare = inFinder && x >= 2 && x <= 4 && y >= 2 && y <= 4;

      matrix[nextRow][nextCol] = outerRing || innerSquare;
    }
  }
}

function placeAlignment(matrix: boolean[][], reserved: boolean[][], row: number, col: number) {
  for (let y = -2; y <= 2; y += 1) {
    for (let x = -2; x <= 2; x += 1) {
      const nextRow = row + y;
      const nextCol = col + x;
      const edge = Math.abs(x) === 2 || Math.abs(y) === 2;
      const center = x === 0 && y === 0;

      reserved[nextRow][nextCol] = true;
      matrix[nextRow][nextCol] = edge || center;
    }
  }
}

function buildQrMatrix(payload: string) {
  const matrix = Array.from({ length: QR_SIZE }, () => Array(QR_SIZE).fill(false));
  const reserved = Array.from({ length: QR_SIZE }, () => Array(QR_SIZE).fill(false));
  const random = createRandom(createSeed(payload));

  placeFinder(matrix, reserved, 0, 0);
  placeFinder(matrix, reserved, 0, QR_SIZE - 7);
  placeFinder(matrix, reserved, QR_SIZE - 7, 0);
  placeAlignment(matrix, reserved, QR_SIZE - 8, QR_SIZE - 8);

  for (let index = 8; index < QR_SIZE - 8; index += 1) {
    reserved[6][index] = true;
    reserved[index][6] = true;
    matrix[6][index] = index % 2 === 0;
    matrix[index][6] = index % 2 === 0;
  }

  for (let index = 0; index < 15; index += 1) {
    const dark = (createSeed(`${payload}:${index}`) + index) % 3 !== 0;
    const row = index < 8 ? 8 : QR_SIZE - 15 + index;
    const col = index < 8 ? index : 8;

    if (row >= 0 && row < QR_SIZE && col >= 0 && col < QR_SIZE && !reserved[row][col]) {
      reserved[row][col] = true;
      matrix[row][col] = dark;
    }
  }

  for (let col = QR_SIZE - 1; col >= 0; col -= 2) {
    if (col === 6) col -= 1;

    const upward = ((QR_SIZE - 1 - col) / 2) % 2 === 0;

    for (let offset = 0; offset < QR_SIZE; offset += 1) {
      const row = upward ? QR_SIZE - 1 - offset : offset;

      for (let pair = 0; pair < 2; pair += 1) {
        const nextCol = col - pair;
        if (nextCol < 0 || reserved[row][nextCol]) continue;

        const pattern = (row + nextCol) % 3 === 0 || (row * nextCol) % 7 === 0;
        matrix[row][nextCol] = random() > (pattern ? 0.42 : 0.58);
      }
    }
  }

  return matrix;
}

export default function ReceivePage() {
  const { currentProfile } = useBanking();
  const bankSectionRef = useRef<HTMLElement | null>(null);
  const qrSectionRef = useRef<HTMLElement | null>(null);
  const requestSectionRef = useRef<HTMLFormElement | null>(null);
  const [method, setMethod] = useState<ReceiveMethod>("bank");
  const [cryptoWallet, setCryptoWallet] = useState<CryptoWalletId>("btc");
  const [payer, setPayer] = useState("");
  const [amount, setAmount] = useState("500");
  const [note, setNote] = useState("Payment request from Aurex Bank");
  const [notice, setNotice] = useState("");
  const [requestReady, setRequestReady] = useState(false);
  const [cryptoWalletOpen, setCryptoWalletOpen] = useState(false);

  const requestAmount = Number(amount);
  const validAmount = Number.isFinite(requestAmount) && requestAmount > 0;
  const accountNumber = "0707100449";
  const routingNumber = "110000001";
  const activeMethod = methods.find((item) => item.id === method) ?? methods[0];
  const activeWallet =
    cryptoWallets.find((wallet) => wallet.id === cryptoWallet) ?? cryptoWallets[0];
  const receivingTarget = method === "crypto" ? activeWallet.address : accountNumber;
  const receivingRail = method === "crypto" ? activeWallet.network : activeMethod.title;

  const requestCode = useMemo(() => {
    const seed = `${currentProfile.customerId}-${method}-${amount}-${payer}`.replace(/\W/g, "");
    return `ARX-${seed.slice(0, 10).toUpperCase() || "REQUEST"}`;
  }, [amount, currentProfile.customerId, method, payer]);

  const shareText =
    method === "crypto"
      ? [
          "Aurex Bank crypto receiving details",
          `Name: ${currentProfile.fullName}`,
          `Asset: ${activeWallet.title}`,
          `Network: ${activeWallet.network}`,
          `Wallet: ${activeWallet.address}`,
          `Reference: ${requestCode}`,
        ].join("\n")
      : [
          "Aurex Bank receiving details",
          `Name: ${currentProfile.fullName}`,
          `Account: ${accountNumber}`,
          `Routing: ${routingNumber}`,
          `Reference: ${requestCode}`,
        ].join("\n");
  const qrPayload = [
    "AUREX-PAY",
    requestCode,
    currentProfile.fullName,
    receivingTarget,
    receivingRail,
    method,
    method === "crypto" ? activeWallet.title : "AUREX",
    validAmount ? money(requestAmount) : "0.00",
    payer || "payer",
  ].join("|");
  const qrMatrix = useMemo(() => buildQrMatrix(qrPayload), [qrPayload]);

  async function copyText(value: string, message: string) {
    try {
      await navigator.clipboard.writeText(value);
      setNotice(message);
    } catch {
      setNotice(value);
    }
  }

  function scrollToSection(section: HTMLElement | null) {
    window.requestAnimationFrame(() => {
      section?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  }

  function selectMethod(nextMethod: ReceiveMethod) {
    setMethod(nextMethod);

    if (nextMethod === "bank") {
      scrollToSection(bankSectionRef.current);
      return;
    }

    if (nextMethod === "qr") {
      scrollToSection(qrSectionRef.current);
      return;
    }

    setCryptoWalletOpen(true);
    scrollToSection(requestSectionRef.current);
  }

  function createRequest(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!validAmount) {
      setNotice("Enter a valid request amount.");
      return;
    }

    setRequestReady(true);
    setNotice("Payment request generated.");
  }

  return (
    <main className="bank-shell min-h-screen overflow-x-hidden text-white">
      <DesktopSidebar />

      <div className="app-content desktop-page-content">
        <div className="app-inner">
          <section className="bank-surface mb-6 rounded-lg p-6 lg:p-8">
            <div className="flex items-center gap-3">
              <span className="h-2.5 w-2.5 rounded-full bg-green-400" />
              <p className="text-xs font-bold uppercase tracking-[0.22em] text-green-400">
                Secure Incoming Payments
              </p>
            </div>
            <h1 className="mt-4 text-4xl font-black tracking-tight lg:text-5xl">
              Receive Money
            </h1>
            <p className="mt-3 max-w-3xl text-base leading-relaxed text-zinc-400">
              Create payment requests, share verified account details, and collect through bank, QR, or crypto rails.
            </p>
          </section>

          <div className="grid min-w-0 gap-6 2xl:grid-cols-[minmax(0,1fr)_minmax(320px,380px)]">
            <div className="min-w-0 space-y-6">
              <div className="grid gap-4 xl:grid-cols-3">
                {methods.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => selectMethod(item.id)}
                    className={`bank-surface rounded-lg p-5 text-left transition-all hover:bg-white/[0.055] ${
                      method === item.id ? "border-green-300/50" : ""
                    }`}
                  >
                    <div className="flex h-12 w-12 items-center justify-center rounded-md bg-green-400/10 text-green-300">
                      <AppIcon name={item.icon} className="h-5 w-5" />
                    </div>
                    <h2 className="mt-5 text-xl font-black">{item.title}</h2>
                    <p className="mt-2 text-sm leading-relaxed text-zinc-500">{item.desc}</p>
                  </button>
                ))}
              </div>

              <section ref={bankSectionRef} id="bank-transfer" className="scroll-mt-24 bank-surface rounded-lg p-6">
                <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="text-sm font-semibold text-green-400">Receiving Account</p>
                    <h2 className="mt-1 text-3xl font-black tracking-tight">Aurex Checking</h2>
                  </div>
                  <button
                    type="button"
                    onClick={() => copyText(shareText, "Receiving details copied.")}
                    className="rounded-lg bg-green-400 px-5 py-3 text-sm font-black text-black transition-all hover:bg-green-300"
                  >
                    Share Details
                  </button>
                </div>

                <div className="grid min-w-0 gap-4 lg:grid-cols-2">
                  {[
                    { label: "Bank Name", value: "Aurex Bank" },
                    { label: "Account Number", value: accountNumber },
                    { label: "Routing Number", value: routingNumber },
                    { label: "Reference", value: requestCode },
                  ].map((item, index) => (
                    <button
                      key={`${item.label}-${index}`}
                      type="button"
                      onClick={() => copyText(item.value, `${item.label} copied.`)}
                      className="bank-panel rounded-lg p-5 text-left transition-all hover:bg-white/[0.04]"
                    >
                      <p className="text-sm text-zinc-500">{item.label}</p>
                      <h3 className="mt-3 break-all text-2xl font-black">{item.value}</h3>
                    </button>
                  ))}
                </div>

                <div className="bank-panel mt-4 rounded-lg p-5">
                  <p className="text-sm text-zinc-500">Account Holder</p>
                  <h3 className="mt-3 break-words text-2xl font-black">{currentProfile.fullName}</h3>
                </div>

                <div className="mt-4 rounded-lg border border-green-300/15 bg-green-400/[0.07] p-4 text-sm leading-relaxed text-zinc-400">
                  Share these receiving details only with people or businesses you trust.
                </div>
              </section>

              <form ref={requestSectionRef} onSubmit={createRequest} className="scroll-mt-24 bank-surface rounded-lg p-6">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <p className="text-sm font-semibold text-green-400">Smart Requests</p>
                    <h2 className="mt-1 text-3xl font-black tracking-tight">Request Payment</h2>
                  </div>
                  <span className="w-fit rounded-md border border-white/10 bg-white/[0.04] px-3 py-2 text-xs font-black uppercase tracking-[0.14em] text-zinc-400">
                    {activeMethod.title}
                  </span>
                </div>

                <div className="mt-6 grid min-w-0 gap-4 lg:grid-cols-2">
                  <label className="block">
                    <span className="text-sm text-zinc-400">Payer name</span>
                    <input
                      type="text"
                      value={payer}
                      onChange={(event) => setPayer(event.target.value)}
                      placeholder="Recipient name"
                      className="mt-2 h-12 w-full rounded-lg border border-white/10 bg-black/30 px-4 text-sm font-semibold outline-none placeholder:text-zinc-600 focus:border-green-400/40"
                    />
                  </label>
                  <label className="block">
                    <span className="text-sm text-zinc-400">Amount</span>
                    <input
                      type="number"
                      value={amount}
                      onChange={(event) => setAmount(event.target.value)}
                      placeholder="$500"
                      min="0"
                      step="0.01"
                      className="mt-2 h-12 w-full rounded-lg border border-white/10 bg-black/30 px-4 text-sm font-semibold outline-none placeholder:text-zinc-600 focus:border-green-400/40"
                    />
                  </label>
                </div>

                {method === "crypto" && (
                  <div className="mt-4 grid min-w-0 gap-4 lg:grid-cols-[minmax(0,0.75fr)_minmax(0,1.25fr)]">
                    <label className="block">
                      <span className="text-sm text-zinc-400">Wallet type</span>
                      <select
                        value={cryptoWallet}
                        onChange={(event) =>
                          setCryptoWallet(event.target.value as CryptoWalletId)
                        }
                        className="mt-2 h-12 w-full rounded-lg border border-white/10 bg-black/30 px-4 text-sm font-semibold outline-none focus:border-green-400/40"
                      >
                        {cryptoWallets.map((wallet) => (
                          <option key={wallet.id} value={wallet.id}>
                            {wallet.title} - {wallet.network}
                          </option>
                        ))}
                      </select>
                    </label>
                    <button
                      type="button"
                      onClick={() =>
                        copyText(activeWallet.address, `${activeWallet.title} wallet copied.`)
                      }
                      className="bank-panel rounded-lg p-4 text-left transition-all hover:bg-white/[0.04]"
                    >
                      <p className="text-xs font-black uppercase tracking-[0.14em] text-zinc-500">
                        Active Receiving Wallet
                      </p>
                      <h3 className="mt-2 break-all text-sm font-black text-white">
                        {activeWallet.address}
                      </h3>
                    </button>
                  </div>
                )}

                <label className="mt-4 block">
                  <span className="text-sm text-zinc-400">Payment note</span>
                  <textarea
                    value={note}
                    onChange={(event) => setNote(event.target.value)}
                    placeholder="Add payment note..."
                    className="mt-2 h-32 w-full resize-none rounded-lg border border-white/10 bg-black/30 px-4 py-3 text-sm font-semibold outline-none placeholder:text-zinc-600 focus:border-green-400/40"
                  />
                </label>

                <div className="mt-5 flex flex-wrap gap-3">
                  <button className="rounded-lg bg-green-400 px-6 py-4 text-sm font-black text-black transition-all hover:bg-green-300">
                    Generate Payment Request
                  </button>
                    {requestReady && (
                    <button
                      type="button"
                      onClick={() =>
                        copyText(
                          `${requestCode} / ${payer || "Payer"} / $${money(requestAmount)} / ${note}`,
                          "Payment request copied."
                        )
                      }
                      className="bank-button rounded-lg px-6 py-4 text-sm font-black"
                    >
                      Copy Request
                    </button>
                  )}
                </div>

                {notice && (
                  <div className="mt-4 rounded-lg border border-white/10 bg-white/[0.035] px-4 py-3 text-sm font-semibold text-zinc-300">
                    {notice}
                  </div>
                )}
              </form>
            </div>

            <div className="min-w-0 space-y-6">
              <section
                ref={qrSectionRef}
                id="qr-payment"
                className="scroll-mt-24 bank-surface rounded-lg p-6"
              >
                <div className="grid min-w-0 gap-6 lg:grid-cols-[minmax(0,0.95fr)_minmax(220px,270px)] lg:items-center">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-green-400">QR Collection</p>
                    <h2 className="mt-2 text-3xl font-black tracking-tight">Receive Instantly</h2>
                    <p className="mt-3 text-sm leading-relaxed text-zinc-500">
                      QR payment now opens here from the method card. Generate a request to attach
                      an amount, payer, note, and live reference.
                    </p>

                    <div className="mt-5 grid gap-3 sm:grid-cols-2">
                      <div className="rounded-lg border border-white/10 bg-black/25 p-4">
                        <p className="text-xs font-black uppercase tracking-[0.14em] text-zinc-500">
                          Reference
                        </p>
                        <h3 className="mt-2 break-words text-lg font-black">
                          {requestReady ? requestCode : "Pending request"}
                        </h3>
                      </div>
                      <div className="rounded-lg border border-white/10 bg-black/25 p-4">
                        <p className="text-xs font-black uppercase tracking-[0.14em] text-zinc-500">
                          Expected
                        </p>
                        <h3 className="mt-2 text-lg font-black">
                          <PrivateAmount
                            value={validAmount ? requestAmount : 0}
                            maximumFractionDigits={2}
                            minimumFractionDigits={2}
                          />
                        </h3>
                      </div>
                    </div>

                    <div className="mt-4 flex flex-wrap gap-3">
                      <button
                        type="button"
                        onClick={() => selectMethod("qr")}
                        className="rounded-lg bg-green-400 px-5 py-3 text-sm font-black text-black transition-all hover:bg-green-300"
                      >
                        QR Payment
                      </button>
                      <button
                        type="button"
                        onClick={() => setCryptoWalletOpen(true)}
                        className="bank-button rounded-lg px-5 py-3 text-sm font-black"
                      >
                        Open Crypto Wallet
                      </button>
                    </div>

                    <p className="mt-5 break-words font-mono text-xs leading-relaxed text-zinc-500">
                      {requestReady ? qrPayload : "Generate a request to attach a live reference."}
                    </p>
                  </div>

                  <div className="mx-auto w-full max-w-64 rounded-lg border border-white/10 bg-white p-3 shadow-[0_18px_55px_rgba(0,0,0,0.28)] lg:mx-0 lg:justify-self-end">
                    <div
                      className="grid aspect-square w-full gap-0"
                      style={{
                        gridTemplateColumns: `repeat(${QR_SIZE}, minmax(0, 1fr))`,
                      }}
                    >
                      {qrMatrix.flatMap((row, rowIndex) =>
                        row.map((dark, colIndex) => (
                          <span
                            key={`${requestCode}-${rowIndex}-${colIndex}`}
                            className={dark ? "bg-black" : "bg-white"}
                          />
                        ))
                      )}
                    </div>
                  </div>
                </div>
              </section>

              <section className="bank-surface rounded-lg p-6">
                <p className="text-sm font-semibold text-green-400">Rail Details</p>
                <h2 className="mt-2 text-3xl font-black tracking-tight">{activeMethod.title}</h2>
                <div className="mt-6 space-y-3">
                  {[
                    {
                      label: "Expected",
                      value: (
                        <PrivateAmount
                          value={validAmount ? requestAmount : 0}
                          maximumFractionDigits={2}
                          minimumFractionDigits={2}
                        />
                      ),
                    },
                    { label: "Reference", value: requestCode },
                    {
                      label: "Rail",
                      value: method === "crypto" ? activeWallet.network : activeMethod.title,
                    },
                    {
                      label: "Wallet",
                      value:
                        method === "crypto"
                          ? activeWallet.address
                          : "Select a crypto wallet for blockchain receipts",
                    },
                  ].map((item, index) => (
                    <div key={`${item.label}-${index}`} className="bank-panel rounded-lg p-4">
                      <p className="text-xs font-black uppercase tracking-[0.14em] text-zinc-500">
                        {item.label}
                      </p>
                      <h3 className="mt-2 break-words text-lg font-black">{item.value}</h3>
                    </div>
                  ))}
                </div>
              </section>

              <section className="rounded-lg border border-green-300/15 bg-green-400/[0.07] p-6">
                <p className="text-sm font-semibold text-green-400">Aurex Secure</p>
                <h2 className="mt-2 text-3xl font-black tracking-tight">Protected Collections</h2>
                <div className="mt-6 space-y-3">
                  {[
                    "Fraud monitoring enabled",
                    "Encrypted settlement routing",
                    "Payment verification active",
                    "Secure account infrastructure",
                  ].map((item) => (
                    <div key={item} className="flex items-center gap-3">
                      <span className="h-2.5 w-2.5 rounded-full bg-green-400" />
                      <p className="text-sm text-zinc-400">{item}</p>
                    </div>
                  ))}
                </div>
              </section>
            </div>
          </div>

        </div>
      </div>

      {cryptoWalletOpen && (
        <div className="fixed inset-0 z-[80] flex items-start justify-center overflow-y-auto bg-black/75 p-3 backdrop-blur-xl sm:items-center sm:p-4">
          <section
            role="dialog"
            aria-modal="true"
            aria-label="Crypto wallet collection"
            className="my-4 w-full max-w-4xl rounded-lg border border-green-300/20 bg-[#06110c] p-5 shadow-2xl sm:p-6"
          >
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
              <div className="min-w-0">
                <p className="text-sm font-semibold text-green-400">Crypto Wallet</p>
                <h2 className="mt-1 text-3xl font-black tracking-tight">
                  Blockchain Asset Receipts
                </h2>
                <p className="mt-3 max-w-2xl text-sm leading-relaxed text-zinc-500">
                  Choose BTC, ETH, stablecoin, or BNB wallet details, then copy the correct
                  receiving address with the active payment reference.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setCryptoWalletOpen(false)}
                className="bank-button rounded-lg px-4 py-3 text-sm font-black"
              >
                Close
              </button>
            </div>

            <div className="mt-6 grid min-w-0 gap-5 lg:grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)]">
              <div className="grid gap-3">
                {cryptoWallets.map((wallet) => (
                  <button
                    key={wallet.id}
                    type="button"
                    onClick={() => {
                      setMethod("crypto");
                      setCryptoWallet(wallet.id);
                    }}
                    className={`rounded-lg border p-4 text-left transition-all ${
                      cryptoWallet === wallet.id
                        ? "border-green-300/50 bg-green-400/15"
                        : "border-white/10 bg-black/25 hover:bg-white/[0.055]"
                    }`}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <h3 className="text-xl font-black">{wallet.title}</h3>
                      <span className="rounded-md border border-white/10 bg-white/[0.04] px-3 py-1.5 text-xs font-black text-zinc-400">
                        {wallet.network}
                      </span>
                    </div>
                    <p className="mt-2 text-sm text-zinc-500">{wallet.settlement}</p>
                  </button>
                ))}
              </div>

              <div className="rounded-lg border border-white/10 bg-black/30 p-5">
                <div className="flex min-w-0 flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0">
                    <p className="text-xs font-black uppercase tracking-[0.16em] text-green-300">
                      Active Wallet
                    </p>
                    <h3 className="mt-2 text-3xl font-black">
                      {activeWallet.title} / {activeWallet.network}
                    </h3>
                    <p className="mt-3 break-all font-mono text-sm leading-relaxed text-zinc-400">
                      {activeWallet.address}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() =>
                      copyText(activeWallet.address, `${activeWallet.title} wallet copied.`)
                    }
                    className="rounded-lg bg-green-400 px-5 py-3 text-sm font-black text-black transition-all hover:bg-green-300"
                  >
                    Copy Wallet
                  </button>
                </div>

                <div className="mt-6 grid gap-3 sm:grid-cols-2">
                  {[
                    { label: "Reference", value: requestCode },
                    {
                      label: "Expected",
                      value: validAmount ? `$${money(requestAmount)}` : "$0.00",
                    },
                    { label: "Payer", value: payer || "Not assigned" },
                    { label: "Settlement", value: activeWallet.settlement },
                  ].map((item, index) => (
                    <div key={`${item.label}-${index}`} className="rounded-lg border border-white/10 bg-white/[0.025] p-4">
                      <p className="text-xs font-black uppercase tracking-[0.14em] text-zinc-500">
                        {item.label}
                      </p>
                      <h4 className="mt-2 break-words text-sm font-black text-white">
                        {item.value}
                      </h4>
                    </div>
                  ))}
                </div>

                <div className="mt-6 grid gap-3 sm:grid-cols-2">
                  <button
                    type="button"
                    onClick={() =>
                      copyText(
                        [
                          "Aurex Bank crypto payment request",
                          `Asset: ${activeWallet.title}`,
                          `Network: ${activeWallet.network}`,
                          `Wallet: ${activeWallet.address}`,
                          `Reference: ${requestCode}`,
                          `Amount: ${validAmount ? `$${money(requestAmount)}` : "$0.00"}`,
                          `Note: ${note}`,
                        ].join("\n"),
                        "Crypto request copied."
                      )
                    }
                    className="bank-button rounded-lg px-5 py-4 text-sm font-black"
                  >
                    Copy Full Request
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setCryptoWalletOpen(false);
                      scrollToSection(qrSectionRef.current);
                    }}
                    className="bank-button rounded-lg px-5 py-4 text-sm font-black"
                  >
                    View QR Code
                  </button>
                </div>
              </div>
            </div>
          </section>
        </div>
      )}

      <BottomNav />
    </main>
  );
}
