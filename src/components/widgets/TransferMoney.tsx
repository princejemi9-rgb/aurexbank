"use client";

import { useState } from "react";

import { useBanking } from "../../context/BankingContext";
import { PrivateAmount } from "../ui/PrivateAmount";
import {
  completeTransferVerificationRequest,
  createTransferVerificationRequest,
  notifyAdminTransferCode,
  transferVerificationCodeMatches,
  type TransferVerificationRequest,
} from "../../lib/transferVerification";

export default function TransferMoney() {
  const { balance, currentProfile, submitTransfer } = useBanking();
  const [transferType, setTransferType] = useState("internal");
  const [accountType, setAccountType] = useState("checking");
  const [receiver, setReceiver] = useState("");
  const [bankName, setBankName] = useState("");
  const [accountNumber, setAccountNumber] = useState("");
  const [swift, setSwift] = useState("");
  const [wallet, setWallet] = useState("");
  const [amount, setAmount] = useState("");
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState("");
  const [verificationCode, setVerificationCode] = useState("");
  const [verificationError, setVerificationError] = useState("");
  const [pendingVerification, setPendingVerification] =
    useState<TransferVerificationRequest | null>(null);

  const transferAmount = Number(amount || 0);

  function buildTransferInput() {
    return {
      transferType,
      accountType,
      receiver: receiver || accountNumber || swift || wallet || "External account",
      bankName,
      accountNumber,
      swift,
      wallet,
      amount: transferAmount,
    };
  }

  async function sendMoney() {
    setLoading(true);
    setStatus("");
    setVerificationError("");

    const request = createTransferVerificationRequest({
      ...buildTransferInput(),
      sender: currentProfile.username,
      senderName: currentProfile.fullName,
    });

    await notifyAdminTransferCode(request).catch(() => {});

    setLoading(false);
    setPendingVerification(request);
    setVerificationCode("");
    setStatus("Verification code sent for review. Enter the approved code to complete this transfer.");
  }

  async function verifyAndSendMoney() {
    if (!pendingVerification) return;

    setStatus("");
    setVerificationError("");

    if (!transferVerificationCodeMatches(pendingVerification.id, verificationCode)) {
      setVerificationError("Invalid verification code. Confirm the latest approved code.");
      return;
    }

    setLoading(true);

    try {
      const result = await submitTransfer({
        transferType: pendingVerification.transferType,
        accountType: pendingVerification.accountType,
        receiver: pendingVerification.receiver,
        bankName: pendingVerification.bankName,
        accountNumber: pendingVerification.accountNumber,
        swift: pendingVerification.swift,
        wallet: pendingVerification.wallet,
        amount: pendingVerification.amount,
      });
      setStatus(result.message);

      if (result.ok) {
        completeTransferVerificationRequest(pendingVerification.id);
        setPendingVerification(null);
        setVerificationCode("");
        setReceiver("");
        setBankName("");
        setAccountNumber("");
        setSwift("");
        setWallet("");
        setAmount("");
      }
    } catch {
      setStatus("Unable to complete transfer. Please check your connection and try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="bank-surface mt-6 rounded-lg p-6">
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.2em] text-green-400">
            Payments
          </p>
          <h2 className="mt-2 text-3xl font-black tracking-tight">
            Transfer Money
          </h2>
          <p className="mt-2 text-sm text-zinc-500">
            Available balance:{" "}
            <PrivateAmount value={balance} maximumFractionDigits={0} minimumFractionDigits={0} />
          </p>
        </div>

        <div className="rounded-lg border border-green-300/15 bg-green-400/10 px-4 py-3 text-sm font-black text-green-300">
          Secure
        </div>
      </div>

      <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
        {["internal", "bank", "wire", "crypto"].map((type) => (
          <button
            key={type}
            onClick={() => setTransferType(type)}
            className={`rounded-lg py-3 font-black capitalize transition-all ${
              transferType === type
                ? "bg-green-400 text-black"
                : "bank-button text-white"
            }`}
          >
            {type}
          </button>
        ))}
      </div>

      <div className="grid gap-4">
        <select
          value={accountType}
          onChange={(event) => setAccountType(event.target.value)}
          className="w-full rounded-lg border border-white/10 bg-black/30 p-4 outline-none focus:border-green-400/40"
        >
          <option value="checking">Checking Account</option>
          <option value="savings">Savings Account</option>
          <option value="crypto">Crypto Wallet</option>
        </select>

        {transferType === "internal" && (
          <input
            type="text"
            placeholder="Receiver username"
            value={receiver}
            onChange={(event) => setReceiver(event.target.value)}
            className="w-full rounded-lg border border-white/10 bg-black/30 p-4 outline-none placeholder:text-zinc-600 focus:border-green-400/40"
          />
        )}

        {transferType === "bank" && (
          <div className="grid gap-4 sm:grid-cols-2">
            <input
              type="text"
              placeholder="Bank name"
              value={bankName}
              onChange={(event) => setBankName(event.target.value)}
              className="w-full rounded-lg border border-white/10 bg-black/30 p-4 outline-none placeholder:text-zinc-600 focus:border-green-400/40"
            />

            <input
              type="text"
              placeholder="Account number"
              value={accountNumber}
              onChange={(event) => setAccountNumber(event.target.value)}
              className="w-full rounded-lg border border-white/10 bg-black/30 p-4 outline-none placeholder:text-zinc-600 focus:border-green-400/40"
            />
          </div>
        )}

        {transferType === "wire" && (
          <input
            type="text"
            placeholder="SWIFT / IBAN"
            value={swift}
            onChange={(event) => setSwift(event.target.value)}
            className="w-full rounded-lg border border-white/10 bg-black/30 p-4 outline-none placeholder:text-zinc-600 focus:border-green-400/40"
          />
        )}

        {transferType === "crypto" && (
          <input
            type="text"
            placeholder="Wallet address"
            value={wallet}
            onChange={(event) => setWallet(event.target.value)}
            className="w-full rounded-lg border border-white/10 bg-black/30 p-4 outline-none placeholder:text-zinc-600 focus:border-green-400/40"
          />
        )}

        <input
          type="number"
          placeholder="Amount"
          value={amount}
          onChange={(event) => setAmount(event.target.value)}
          className="w-full rounded-lg border border-white/10 bg-black/30 p-4 text-2xl font-black outline-none placeholder:text-zinc-700 focus:border-green-400/40"
        />

        {status && (
          <div className="rounded-lg border border-white/10 bg-white/[0.035] p-4 text-sm font-semibold text-zinc-300">
            {status}
          </div>
        )}

        {pendingVerification && (
          <div className="rounded-lg border border-green-300/15 bg-green-400/[0.07] p-4">
            <p className="text-sm font-semibold text-green-400">
              Transfer Verification Required
            </p>
            <input
              inputMode="numeric"
              maxLength={6}
              value={verificationCode}
              onChange={(event) =>
                setVerificationCode(event.target.value.replace(/\D/g, "").slice(0, 6))
              }
              placeholder="000000"
              className="mt-3 h-12 w-full rounded-lg border border-white/10 bg-black/30 px-4 text-center text-2xl font-black tracking-[0.28em] outline-none placeholder:text-zinc-700 focus:border-green-400/40"
            />
            {verificationError && (
              <p className="mt-3 text-sm font-semibold text-red-200">
                {verificationError}
              </p>
            )}
          </div>
        )}

        <button
          onClick={pendingVerification ? verifyAndSendMoney : sendMoney}
          disabled={
            loading ||
            transferAmount <= 0 ||
            (pendingVerification !== null && verificationCode.length !== 6)
          }
          className="w-full rounded-lg bg-green-400 py-4 font-black text-black transition-all hover:bg-green-300 active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-60"
        >
          {loading
            ? pendingVerification
              ? "Verifying..."
              : "Sending Code..."
            : pendingVerification
              ? "Verify and Send"
              : "Send Money"}
        </button>
      </div>
    </div>
  );
}
