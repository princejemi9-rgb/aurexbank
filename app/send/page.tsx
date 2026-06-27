"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import jsPDF from "jspdf";

import DesktopSidebar from "../../src/components/layout/DesktopSidebar";
import BottomNav from "../../src/components/navigation/BottomNav";
import AppIcon from "../../src/components/ui/AppIcon";
import { BalancePrivacyToggle, PrivateAmount } from "../../src/components/ui/PrivateAmount";
import { useBanking } from "../../src/context/BankingContext";
import { useBranding } from "../../src/context/BrandingContext";
import {
  completeTransferVerificationRequest,
  createTransferVerificationRequest,
  getTransferVerificationRequest,
  notifyAdminTransferCode,
  transferVerificationCodeMatches,
  type TransferVerificationRequest,
} from "../../src/lib/transferVerification";

type TransferTypeId = "internal" | "bank" | "wire" | "crypto";

type TransferType = {
  id: TransferTypeId;
  title: string;
  desc: string;
  icon: "receive" | "bank" | "send" | "crypto";
  feeLabel: string;
  feeAmount: number;
  timeline: string;
  limit: string;
  rail: string;
  verification: string;
  features: string[];
};

type DetailItem = {
  label: string;
  value: ReactNode;
  green?: boolean;
};

type SavedRecipient = {
  id: string;
  transferType: TransferTypeId;
  recipientName: string;
  recipientContact: string;
  bankName: string;
  accountNumber: string;
  routingNumber: string;
  recipientAccountType: string;
  swift: string;
  wallet: string;
  cryptoNetwork: string;
  recipientAddress: string;
  wireCountry: string;
  wireCurrency: string;
  transferPurpose: string;
  updatedAt: string;
};

type TransferReceipt = {
  transactionId: string;
  reference: string;
  transferTitle: string;
  senderName: string;
  senderUsername: string;
  recipient: string;
  destination: string;
  rail: string;
  amount: number;
  fee: number;
  totalDebit: number;
  balanceBefore: number;
  balanceAfter: number;
  completedAt: string;
  note: string;
};

const transferTypes: TransferType[] = [
  {
    id: "internal",
    title: "Internal",
    desc: "Aurex Bank transfers",
    icon: "receive",
    feeLabel: "$0",
    feeAmount: 0,
    timeline: "Instant",
    limit: "$50,000 daily",
    rail: "Aurex Core",
    verification: "Aurex username match",
    features: [
      "Instant Aurex-to-Aurex settlement",
      "No transfer fee",
      "Recipient identity confirmation",
      "Available 24/7",
    ],
  },
  {
    id: "bank",
    title: "Bank",
    desc: "Local bank payments",
    icon: "bank",
    feeLabel: "$2",
    feeAmount: 2,
    timeline: "Same day",
    limit: "$10,000 daily",
    rail: "Local clearing",
    verification: "Account and bank check",
    features: [
      "Recipient legal name and account type",
      "Bank name, account number, and routing / sort code",
      "Payment reference recorded for review",
      "Same-day settlement window",
    ],
  },
  {
    id: "wire",
    title: "Wire",
    desc: "International transfer",
    icon: "send",
    feeLabel: "$15",
    feeAmount: 15,
    timeline: "1-3 business days",
    limit: "$100,000 daily",
    rail: "SWIFT network",
    verification: "SWIFT / IBAN review",
    features: [
      "Beneficiary name, address, and country",
      "Receiving bank, SWIFT/BIC, and IBAN support",
      "Currency and payment purpose review",
      "Compliance screening before release",
    ],
  },
  {
    id: "crypto",
    title: "Crypto",
    desc: "Blockchain transfer",
    icon: "crypto",
    feeLabel: "Gas",
    feeAmount: 0,
    timeline: "Network dependent",
    limit: "$25,000 daily",
    rail: "Blockchain",
    verification: "Wallet address scan",
    features: [
      "BTC, ETH, and stablecoin networks",
      "Wallet address risk screening",
      "Network gas paid on-chain",
      "Irreversible settlement after broadcast",
    ],
  },
];

const localBanks = [
  "Chase Bank",
  "Wells Fargo",
  "GTBank",
  "Access Bank",
  "Moniepoint",
  "UBA",
  "Zenith Bank",
];

const wireBanks = [
  "Citibank N.A.",
  "HSBC Bank",
  "Deutsche Bank",
  "Barclays Bank",
  "Standard Chartered",
  "JPMorgan Chase",
];

const cryptoNetworks = [
  "Bitcoin",
  "Ethereum",
  "USDT TRC20",
  "USDC ERC20",
  "BNB Smart Chain",
];

const recipientAccountTypes = ["Checking", "Savings", "Business"];
const transferPurposes = ["Personal transfer", "Family support", "Invoice payment", "Business services"];
const wireCountries = ["United States", "United Kingdom", "Canada", "Nigeria", "Germany", "United Arab Emirates"];
const wireCurrencies = ["USD", "GBP", "EUR", "CAD", "NGN", "AED"];
const secureChecklist = [
  "Admin code must be activated before release",
  "Debit amount and fee are locked for this request",
  "Recipient details are recorded on the receipt",
  "Balance updates immediately after approval",
];

const BACK_EVENT = "aurex:navigate-back";
const RECENT_RECIPIENT_LIMIT = 8;
const transferLimits: Record<TransferTypeId, number> = {
  internal: 50000,
  bank: 10000,
  wire: 100000,
  crypto: 25000,
};

function money(value: number) {
  return value.toLocaleString("en-US", {
    maximumFractionDigits: 2,
    minimumFractionDigits: 2,
  });
}

function receiptMoney(value: number) {
  return `$${money(value)}`;
}

function formatReceiptDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Just now";

  return date.toLocaleString([], {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function buildReceiptRows(receipt: TransferReceipt) {
  return [
    ["Transaction ID", receipt.transactionId],
    ["Status", "Completed"],
    ["Date", formatReceiptDate(receipt.completedAt)],
    ["Recipient", receipt.recipient],
    ["Destination", receipt.destination],
    ["Amount Sent", receiptMoney(receipt.amount)],
    ["Fee", receiptMoney(receipt.fee)],
    ["Total Debit", receiptMoney(receipt.totalDebit)],
    ["Balance After", receiptMoney(receipt.balanceAfter)],
  ];
}

function buildReceiptText(receipt: TransferReceipt, bankName: string) {
  return [
    `${bankName.toUpperCase()} OFFICIAL TRANSFER RECEIPT`,
    "Private Digital Banking",
    "",
    ...buildReceiptRows(receipt).map(([label, value]) => `${label}: ${value}`),
    "",
    `This digital receipt confirms the transfer was approved through ${bankName} Secure.`,
  ].join("\n");
}

function hexToRgb(value: string): [number, number, number] {
  return [
    Number.parseInt(value.slice(1, 3), 16),
    Number.parseInt(value.slice(3, 5), 16),
    Number.parseInt(value.slice(5, 7), 16),
  ];
}

function hasRecipientName(value: string) {
  return value.trim().length >= 2 && /[a-z0-9@._-]/i.test(value);
}

function hasBankName(value: string) {
  return value.trim().length >= 2 && /[a-z]/i.test(value);
}

function isValidSwift(value: string) {
  const normalized = value.trim().toUpperCase().replace(/\s/g, "");
  return /^[A-Z]{4}[A-Z]{2}[A-Z0-9]{2}([A-Z0-9]{3})?$/.test(normalized);
}

function isValidWireAccount(value: string) {
  return /^[A-Z0-9]{6,34}$/.test(value.trim().toUpperCase().replace(/\s/g, ""));
}

function isValidWalletAddress(value: string) {
  return /^[a-zA-Z0-9]{6,120}$/.test(value.trim());
}

function createTransferReference() {
  return `ARX-${Date.now().toString(36).toUpperCase()}-${Math.random()
    .toString(36)
    .slice(2, 6)
    .toUpperCase()}`;
}

function getSecureStatusLabel(status: TransferVerificationRequest["status"] | undefined) {
  if (status === "pending_admin_code") return "Waiting for admin";
  if (status === "pending_code" || status === "pending") return "Code active";
  if (status === "approved") return "Approved";
  if (status === "completed") return "Completed";
  if (status === "rejected") return "Rejected";
  if (status === "suspicious") return "Review hold";
  return "Preparing";
}

function getRecentRecipientsKey(userId: string) {
  return `aurexbank:${userId}:recent-recipients`;
}

function readRecentRecipients(userId: string) {
  if (typeof window === "undefined") return [];

  try {
    const stored = window.localStorage.getItem(getRecentRecipientsKey(userId));
    const parsed = stored ? (JSON.parse(stored) as SavedRecipient[]) : [];
    return Array.isArray(parsed) ? parsed.filter((item) => item?.id) : [];
  } catch {
    return [];
  }
}

function writeRecentRecipients(userId: string, recipients: SavedRecipient[]) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(
    getRecentRecipientsKey(userId),
    JSON.stringify(recipients.slice(0, RECENT_RECIPIENT_LIMIT))
  );
}

function normalizeRecipientKey(value: string) {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}

export default function SendPage() {
  const { branding } = useBranding();
  const {
    balance,
    currentProfile,
    submitTransfer,
    accountStatus,
    transferFrozen,
    verificationStatus,
  } = useBanking();
  const [step, setStep] = useState(1);
  const [selectedType, setSelectedType] = useState<TransferTypeId>("bank");
  const [selectedAccount, setSelectedAccount] = useState("checking");
  const [recipientAccountType, setRecipientAccountType] = useState(recipientAccountTypes[0]);
  const [bankSearch, setBankSearch] = useState("");
  const [accountNumber, setAccountNumber] = useState("");
  const [routingNumber, setRoutingNumber] = useState("");
  const [swift, setSwift] = useState("");
  const [wallet, setWallet] = useState("");
  const [cryptoNetwork, setCryptoNetwork] = useState(cryptoNetworks[0]);
  const [memo, setMemo] = useState("");
  const [recipientAddress, setRecipientAddress] = useState("");
  const [wireCountry, setWireCountry] = useState(wireCountries[0]);
  const [wireCurrency, setWireCurrency] = useState(wireCurrencies[0]);
  const [transferPurpose, setTransferPurpose] = useState(transferPurposes[0]);
  const [recipientContact, setRecipientContact] = useState("");
  const [amount, setAmount] = useState("");
  const [recipient, setRecipient] = useState("");
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState("");
  const [verificationCode, setVerificationCode] = useState("");
  const [verificationError, setVerificationError] = useState("");
  const [pendingVerification, setPendingVerification] =
    useState<TransferVerificationRequest | null>(null);
  const [completedTransactionId, setCompletedTransactionId] = useState("");
  const [completedTransferTitle, setCompletedTransferTitle] = useState("");
  const [completedReceipt, setCompletedReceipt] = useState<TransferReceipt | null>(null);
  const [receiptNotice, setReceiptNotice] = useState("");
  const [reviewAcknowledged, setReviewAcknowledged] = useState(false);
  const [draftReference, setDraftReference] = useState(createTransferReference);
  const [recentRecipientVersion, setRecentRecipientVersion] = useState(0);

  const transfer = transferTypes.find((item) => item.id === selectedType) ?? transferTypes[1];
  const transferAmount = Number(amount || 0);
  const validTransferAmount = Number.isFinite(transferAmount) && transferAmount > 0;
  const fee = validTransferAmount ? transfer.feeAmount : 0;
  const totalDebit = validTransferAmount ? transferAmount + fee : 0;
  const recipientGets = validTransferAmount ? transferAmount : 0;
  const bankOptions = selectedType === "wire" ? wireBanks : localBanks;
  const pendingTransferTitle = pendingVerification
    ? transferTypes.find((item) => item.id === pendingVerification.transferType)?.title ??
      pendingVerification.transferType
    : transfer.title;
  const pendingTransferType =
    pendingVerification
      ? transferTypes.find((item) => item.id === pendingVerification.transferType) ?? transfer
      : transfer;
  const latestVerificationRequest = pendingVerification
    ? getTransferVerificationRequest(pendingVerification.id) ?? pendingVerification
    : null;
  const secureStatusLabel = getSecureStatusLabel(latestVerificationRequest?.status);
  const pendingFee =
    pendingVerification
      ? pendingVerification.fee ?? pendingTransferType.feeAmount
      : fee;
  const pendingTotalDebit = pendingVerification?.totalDebit ?? pendingVerification?.amount ?? totalDebit;
  const pendingRecipientAmount =
    pendingVerification?.transferAmount ?? Math.max(pendingTotalDebit - pendingFee, 0);
  const transferReference = pendingVerification?.reference ?? draftReference;
  const accountOptions = [
    {
      title: "Primary Checking",
      value: "checking",
      amount: balance,
      meta: "Eligible for outgoing bank, wire, internal, and crypto transfers",
    },
  ];
  const selectedSourceAccount =
    accountOptions.find((account) => account.value === selectedAccount) ?? accountOptions[0];
  const routingDigits = routingNumber.replace(/\D/g, "");
  const accountDigits = accountNumber.replace(/\D/g, "");
  const cleanRecipient = recipient.trim();
  const cleanBank = bankSearch.trim();
  const cleanSwift = swift.trim().toUpperCase().replace(/\s/g, "");
  const cleanWallet = wallet.trim();
  const cleanContact = recipientContact.trim();
  const normalizedAccountStatus = accountStatus === "suspended" ? "Suspended" : "Active";
  const transferAvailability = transferFrozen
    ? "Transfers frozen"
    : verificationStatus === "rejected"
      ? "Verification needed"
      : "Transfers active";
  const transferBlocked =
    accountStatus === "suspended" || transferFrozen || verificationStatus === "rejected";
  const activeStage = step <= 3 ? 1 : step === 4 ? 2 : step === 5 ? 3 : 4;
  const stepLabels = ["Details", "Review", "Secure Code", "Receipt"];
  const savedRecipients = useMemo(
    () => {
      void recentRecipientVersion;
      return readRecentRecipients(currentProfile.userId);
    },
    [currentProfile.userId, recentRecipientVersion]
  );

  const destination =
    selectedType === "internal"
      ? recipient
      : selectedType === "crypto"
        ? wallet
        : recipient || accountNumber;
  const recipientSearchTerms = useMemo(
    () =>
      [
        cleanRecipient,
        cleanContact,
        accountNumber.trim(),
        cleanBank,
      ].filter((value) => value.length >= 2),
    [accountNumber, cleanBank, cleanContact, cleanRecipient]
  );
  const suggestedRecipients = useMemo(() => {
    const sourceRecipients = recipientSearchTerms.length
      ? savedRecipients.filter((item) => {
          const searchable = [
            item.recipientName,
            item.recipientContact,
            item.bankName,
            item.accountNumber,
            item.routingNumber,
            item.swift,
            item.wallet,
          ]
            .join(" ")
            .toLowerCase();

          return recipientSearchTerms.some((term) =>
            searchable.includes(term.toLowerCase())
          );
        })
      : savedRecipients;

    return sourceRecipients.slice(0, 4);
  }, [recipientSearchTerms, savedRecipients]);

  function getTransferValidationErrors() {
    const errors: string[] = [];

    if (!selectedSourceAccount) {
      errors.push("Select a funding account.");
    }

    if (transferBlocked) {
      errors.push("Transfers are not available on this account right now.");
    }

    if (!validTransferAmount) {
      errors.push("Enter a transfer amount greater than $0.");
    } else {
      if (transferAmount > transferLimits[selectedType]) {
        errors.push(
          `${transfer.title} transfers are limited to $${money(transferLimits[selectedType])}.`
        );
      }

      if (selectedSourceAccount && totalDebit > selectedSourceAccount.amount) {
        errors.push(
          `Available balance is $${money(selectedSourceAccount.amount)}. Lower the amount or choose another source.`
        );
      }
    }

    if (selectedType === "internal") {
      if (cleanRecipient.length < 3) {
        errors.push("Enter the recipient's Aurex username or email.");
      }

      const currentIdentifiers = [currentProfile.username, currentProfile.email]
        .map((value) => value.trim().toLowerCase())
        .filter(Boolean);

      if (currentIdentifiers.includes(cleanRecipient.toLowerCase())) {
        errors.push("Choose a recipient that is not your own account.");
      }
    }

    if (selectedType === "bank") {
      if (!hasRecipientName(cleanRecipient)) {
        errors.push("Enter the recipient account name.");
      }

      if (!hasBankName(cleanBank)) {
        errors.push("Enter the recipient bank name.");
      }

      if (accountDigits.length < 6 || accountDigits.length > 18) {
        errors.push("Enter a valid 6 to 18 digit account number.");
      }

      if (routingDigits.length < 3 || routingDigits.length > 12) {
        errors.push("Enter a valid routing, sort, or bank code.");
      }

      if (!recipientAccountType) {
        errors.push("Select the recipient account type.");
      }
    }

    if (selectedType === "wire") {
      if (!hasRecipientName(cleanRecipient)) {
        errors.push("Enter the beneficiary's full legal name.");
      }

      if (recipientAddress.trim().length < 5) {
        errors.push("Enter the beneficiary street address and city.");
      }

      if (!hasBankName(cleanBank)) {
        errors.push("Enter the receiving bank name.");
      }

      if (!isValidSwift(cleanSwift)) {
        errors.push("Enter a valid 8 or 11 character SWIFT/BIC code.");
      }

      if (!isValidWireAccount(accountNumber)) {
        errors.push("Enter a valid IBAN or account number.");
      }

      if (!wireCountry || !wireCurrency || !transferPurpose) {
        errors.push("Select the beneficiary country, currency, and payment purpose.");
      }
    }

    if (selectedType === "crypto") {
      if (!cryptoNetwork) {
        errors.push("Select the crypto asset or network.");
      }

      if (!isValidWalletAddress(cleanWallet)) {
        errors.push("Enter a valid wallet address for the selected network.");
      }
    }

    return errors;
  }

  const validationErrors = getTransferValidationErrors();
  const canContinue = validationErrors.length === 0;
  const balanceAfter = selectedSourceAccount
    ? Math.max(selectedSourceAccount.amount - totalDebit, 0)
    : 0;

  const reviewDetails: DetailItem[] = [
    { label: "Reference", value: transferReference },
    { label: "Sender", value: currentProfile.fullName || currentProfile.username },
    { label: "Transfer Type", value: transfer.title },
    { label: "Source", value: selectedSourceAccount?.title ?? selectedAccount },
    { label: selectedType === "crypto" ? "Wallet" : "Recipient", value: destination || "Pending" },
    { label: "Amount", value: <PrivateAmount value={validTransferAmount ? transferAmount : 0} /> },
    { label: "Fee", value: <PrivateAmount value={fee} /> },
    { label: "Total Debit", value: <PrivateAmount value={totalDebit} />, green: true },
    { label: "Balance Before", value: <PrivateAmount value={selectedSourceAccount?.amount ?? 0} /> },
    { label: "Balance After", value: <PrivateAmount value={balanceAfter} /> },
    { label: "Routing", value: selectedType === "crypto" ? cryptoNetwork : bankSearch || transfer.rail },
    { label: "Delivery", value: transfer.timeline },
    ...(cleanContact
      ? [{ label: "Recipient Contact", value: cleanContact }]
      : []),
    ...(selectedType === "bank"
      ? [
          { label: "Recipient Account", value: recipientAccountType },
          { label: "Account Number", value: accountNumber || "Pending" },
          { label: "Routing / Sort Code", value: routingNumber || "Pending" },
          { label: "Reference", value: memo || "Pending" },
        ]
      : []),
    ...(selectedType === "wire"
      ? [
          { label: "Beneficiary Country", value: wireCountry },
          { label: "Currency", value: wireCurrency },
          { label: "Purpose", value: transferPurpose },
          { label: "Beneficiary Address", value: recipientAddress || "Pending" },
          { label: "SWIFT / BIC", value: swift || "Pending" },
          { label: "IBAN / Account", value: accountNumber || "Pending" },
        ]
      : []),
  ];

  useEffect(() => {
    function handlePageBack(event: Event) {
      if (step <= 1) return;

      event.preventDefault();
      setStatus("");
      setLoading(false);
      setStep((currentStep) => Math.max(currentStep - 1, 1));
    }

    window.addEventListener(BACK_EVENT, handlePageBack);

    return () => {
      window.removeEventListener(BACK_EVENT, handlePageBack);
    };
  }, [step]);

  function buildSavedRecipient() {
    const recipientName =
      selectedType === "crypto" ? cryptoNetwork : cleanRecipient;
    const savedAccountNumber = accountNumber.trim();
    const savedBankName = selectedType === "crypto" ? cryptoNetwork : cleanBank;

    if (!recipientName && !savedAccountNumber && !cleanWallet) return null;

    const keyParts = [
      selectedType,
      normalizeRecipientKey(recipientName),
      normalizeRecipientKey(cleanContact),
      normalizeRecipientKey(savedBankName),
      normalizeRecipientKey(savedAccountNumber),
      normalizeRecipientKey(cleanWallet),
    ].filter(Boolean);

    return {
      id: keyParts.join("|") || `${selectedType}|${Date.now()}`,
      transferType: selectedType,
      recipientName,
      recipientContact: cleanContact,
      bankName: savedBankName,
      accountNumber: savedAccountNumber,
      routingNumber: routingNumber.trim(),
      recipientAccountType,
      swift: selectedType === "wire" ? cleanSwift : "",
      wallet: cleanWallet,
      cryptoNetwork,
      recipientAddress: recipientAddress.trim(),
      wireCountry,
      wireCurrency,
      transferPurpose,
      updatedAt: new Date().toISOString(),
    };
  }

  function saveCurrentRecipient() {
    const savedRecipient = buildSavedRecipient();
    if (!savedRecipient) return;

    const currentRecipients = readRecentRecipients(currentProfile.userId);
    const nextRecipients = [
      savedRecipient,
      ...currentRecipients.filter((item) => item.id !== savedRecipient.id),
    ].slice(0, RECENT_RECIPIENT_LIMIT);

    writeRecentRecipients(currentProfile.userId, nextRecipients);
    setRecentRecipientVersion((version) => version + 1);
  }

  function applySavedRecipient(savedRecipient: SavedRecipient) {
    setSelectedType(savedRecipient.transferType);
    setSelectedAccount("checking");
    setRecipient(
      savedRecipient.transferType === "crypto"
        ? ""
        : savedRecipient.recipientName
    );
    setRecipientContact(savedRecipient.recipientContact);
    setBankSearch(savedRecipient.bankName);
    setAccountNumber(savedRecipient.accountNumber);
    setRoutingNumber(savedRecipient.routingNumber);
    setRecipientAccountType(savedRecipient.recipientAccountType || recipientAccountTypes[0]);
    setSwift(savedRecipient.swift);
    setWallet(savedRecipient.wallet);
    setCryptoNetwork(savedRecipient.cryptoNetwork || cryptoNetworks[0]);
    setRecipientAddress(savedRecipient.recipientAddress);
    setWireCountry(savedRecipient.wireCountry || wireCountries[0]);
    setWireCurrency(savedRecipient.wireCurrency || wireCurrencies[0]);
    setTransferPurpose(savedRecipient.transferPurpose || transferPurposes[0]);
    setStatus("");
    setVerificationError("");
    setReviewAcknowledged(false);
    setStep(3);
  }

  function resetTransferDetails(nextType: TransferTypeId) {
    setSelectedType(nextType);
    setSelectedAccount("checking");
    setRecipientAccountType(recipientAccountTypes[0]);
    setRecipient("");
    setBankSearch("");
    setAccountNumber("");
    setRoutingNumber("");
    setSwift("");
    setWallet("");
    setCryptoNetwork(cryptoNetworks[0]);
    setMemo("");
    setRecipientContact("");
    setRecipientAddress("");
    setWireCountry(wireCountries[0]);
    setWireCurrency(wireCurrencies[0]);
    setTransferPurpose(transferPurposes[0]);
    setAmount("");
    setStatus("");
    setVerificationCode("");
    setVerificationError("");
    setPendingVerification(null);
    setCompletedTransactionId("");
    setCompletedTransferTitle("");
    setCompletedReceipt(null);
    setReceiptNotice("");
    setReviewAcknowledged(false);
    setDraftReference(createTransferReference());
    setStep(2);
  }

  function continueToReview() {
    const errors = getTransferValidationErrors();

    if (errors.length) {
      setStatus(errors[0]);
      return;
    }

    setStatus("");
    saveCurrentRecipient();
    setReviewAcknowledged(false);
    setStep(4);
  }

  function buildTransferInput() {
    return {
      transferType: selectedType,
      accountType: selectedAccount,
      receiver: destination,
      bankName: selectedType === "crypto" ? cryptoNetwork : bankSearch,
      accountNumber,
      routingNumber,
      recipientAccountType,
      swift: selectedType === "wire" ? cleanSwift : "",
      wallet,
      memo,
      recipientContact: cleanContact,
      recipientAddress,
      wireCountry,
      wireCurrency,
      transferPurpose,
      amount: totalDebit,
      transferAmount,
      fee,
      totalDebit,
      balanceBefore: selectedSourceAccount?.amount ?? balance,
      balanceAfter,
      reference: transferReference,
    };
  }

  async function handleTransfer() {
    setStatus("");
    setVerificationError("");
    setReceiptNotice("");

    const errors = getTransferValidationErrors();

    if (errors.length) {
      setStatus(errors[0]);
      setStep(3);
      return;
    }

    if (!reviewAcknowledged) {
      setStatus("Confirm the recipient, account details, amount, fee, and source account before sending.");
      return;
    }

    setLoading(true);
    setStatus("Secure code approved. Completing transfer...");

    try {
      const request = createTransferVerificationRequest({
        ...buildTransferInput(),
        sender: currentProfile.username,
        senderName: currentProfile.fullName,
      });

      await notifyAdminTransferCode(request).catch(() => {});

      setPendingVerification(request);
      setVerificationCode("");
      setStatus("Secure code request sent to admin review. Enter the approved code only after it is activated.");
      setStep(5);
    } finally {
      setLoading(false);
    }
  }

  function createCompletedReceipt(
    request: TransferVerificationRequest,
    transactionId: string
  ): TransferReceipt {
    const transferTitle =
      transferTypes.find((item) => item.id === request.transferType)?.title ??
      request.transferType;
    const feeAmount = request.fee ?? 0;
    const totalAmount = request.totalDebit ?? request.amount;
    const sentAmount = request.transferAmount ?? Math.max(totalAmount - feeAmount, 0);
    const destinationLabel =
      request.bankName ||
      request.accountNumber ||
      request.wallet ||
      request.swift ||
      `${branding.bankName} Secure`;

    return {
      transactionId,
      reference: request.reference ?? transactionId,
      transferTitle,
      senderName: request.senderName || currentProfile.fullName,
      senderUsername: request.sender || currentProfile.username,
      recipient: request.receiver || destinationLabel,
      destination: destinationLabel,
      rail: request.bankName || request.transferType,
      amount: sentAmount,
      fee: feeAmount,
      totalDebit: totalAmount,
      balanceBefore: request.balanceBefore ?? balance,
      balanceAfter: request.balanceAfter ?? Math.max(balance - totalAmount, 0),
      completedAt: new Date().toISOString(),
      note: request.memo || request.transferPurpose || "",
    };
  }

  function downloadReceiptPdf(receipt: TransferReceipt) {
    const doc = new jsPDF({ unit: "pt", format: "letter" });
    const rows = buildReceiptRows(receipt);
    const [backgroundRed, backgroundGreen, backgroundBlue] = hexToRgb(
      branding.backgroundColor
    );
    const [primaryRed, primaryGreen, primaryBlue] = hexToRgb(
      branding.primaryColor
    );

    doc.setFillColor(backgroundRed, backgroundGreen, backgroundBlue);
    doc.rect(0, 0, 612, 792, "F");
    doc.setFillColor(8, 26, 17);
    doc.roundedRect(36, 34, 540, 724, 14, 14, "F");
    doc.setDrawColor(primaryRed, primaryGreen, primaryBlue);
    doc.roundedRect(36, 34, 540, 724, 14, 14, "S");

    doc.setFillColor(primaryRed, primaryGreen, primaryBlue);
    doc.roundedRect(62, 58, 48, 48, 10, 10, "F");
    doc.setTextColor(0, 0, 0);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(24);
    doc.text(branding.bankName.slice(0, 1).toUpperCase(), 78, 91);

    doc.setTextColor(255, 255, 255);
    doc.setFontSize(22);
    doc.text(branding.bankName, 126, 78);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.setTextColor(151, 163, 175);
    doc.text("Official Transfer Receipt", 126, 96);

    doc.setFont("helvetica", "bold");
    doc.setFontSize(20);
    doc.setTextColor(primaryRed, primaryGreen, primaryBlue);
    doc.text("TRANSFER COMPLETED", 62, 148);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(11);
    doc.setTextColor(210, 214, 220);
    doc.text(
      `This receipt confirms your transfer was approved through ${branding.bankName} Secure.`,
      62,
      168
    );

    doc.setFillColor(0, 0, 0);
    doc.roundedRect(62, 194, 488, 78, 10, 10, "F");
    doc.setTextColor(151, 163, 175);
    doc.setFontSize(10);
    doc.text("TOTAL DEBIT", 82, 222);
    doc.setTextColor(255, 255, 255);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(28);
    doc.text(receiptMoney(receipt.totalDebit), 82, 254);
    doc.setFontSize(10);
    doc.setTextColor(primaryRed, primaryGreen, primaryBlue);
    doc.text("STATUS: COMPLETED", 394, 222);
    doc.setTextColor(255, 255, 255);
    doc.text(receipt.transactionId, 394, 248);

    let y = 314;
    doc.setFontSize(10);
    rows.forEach(([label, value]) => {
      const wrappedValue = doc.splitTextToSize(String(value), 290);
      const rowHeight = Math.max(28, wrappedValue.length * 13 + 8);

      doc.setDrawColor(38, 38, 38);
      doc.line(62, y - 10, 550, y - 10);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(151, 163, 175);
      doc.text(label.toUpperCase(), 62, y);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(255, 255, 255);
      doc.text(wrappedValue, 248, y);
      y += rowHeight;
    });

    doc.setDrawColor(primaryRed, primaryGreen, primaryBlue);
    doc.line(62, 704, 550, 704);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(151, 163, 175);
    doc.text(`Generated by ${branding.bankName}. Keep this receipt for your records.`, 62, 728);
    doc.text("Private Digital Banking", 62, 742);

    doc.save(`${receipt.transactionId}-receipt.pdf`);
    setReceiptNotice("PDF receipt downloaded.");
  }

  async function copyReceipt(receipt: TransferReceipt) {
    const receiptText = buildReceiptText(receipt, branding.bankName);

    try {
      await navigator.clipboard.writeText(receiptText);
      setReceiptNotice("Receipt details copied.");
    } catch {
      setReceiptNotice(receiptText);
    }
  }

  function printReceipt(receipt: TransferReceipt) {
    const rows = buildReceiptRows(receipt);
    const receiptWindow = window.open("", "_blank", "width=760,height=920");

    if (!receiptWindow) {
      setReceiptNotice("Allow popups to print or save the receipt.");
      return;
    }

    receiptWindow.document.write(`
      <!doctype html>
      <html>
        <head>
          <title>${escapeHtml(receipt.transactionId)} Receipt</title>
          <style>
            body { margin: 0; background: #f3f4f6; color: #111827; font-family: Arial, sans-serif; }
            .receipt { width: 720px; margin: 24px auto; background: white; border: 1px solid #d1d5db; border-radius: 18px; overflow: hidden; }
            .header { background: ${branding.backgroundColor}; color: white; padding: 28px; }
            .brand { display: flex; align-items: center; gap: 14px; }
            .mark { width: 48px; height: 48px; border-radius: 12px; background: ${branding.primaryColor}; color: #03110a; display: grid; place-items: center; font-size: 24px; font-weight: 900; }
            .status { margin-top: 26px; color: ${branding.primaryColor}; font-size: 24px; font-weight: 900; letter-spacing: .08em; }
            .total { margin: 24px 28px 8px; border: 1px solid #d1d5db; border-radius: 14px; padding: 20px; }
            .total p { margin: 0; color: #6b7280; font-size: 12px; font-weight: 900; letter-spacing: .12em; }
            .total h2 { margin: 8px 0 0; font-size: 36px; }
            table { width: calc(100% - 56px); margin: 20px 28px 28px; border-collapse: collapse; }
            td { border-top: 1px solid #e5e7eb; padding: 12px 0; vertical-align: top; }
            td:first-child { width: 34%; color: #6b7280; font-size: 11px; font-weight: 900; letter-spacing: .1em; text-transform: uppercase; }
            td:last-child { font-weight: 800; overflow-wrap: anywhere; }
            .footer { margin: 0 28px 28px; color: #6b7280; font-size: 12px; line-height: 1.5; }
            @media print { body { background: white; } .receipt { margin: 0; width: 100%; border: 0; } }
          </style>
        </head>
        <body>
          <main class="receipt">
            <section class="header">
              <div class="brand">
                <div class="mark">${escapeHtml(branding.bankName.slice(0, 1).toUpperCase())}</div>
                <div>
                  <h1 style="margin:0;font-size:26px">${escapeHtml(branding.bankName)}</h1>
                  <p style="margin:5px 0 0;color:#9ca3af">Official Transfer Receipt</p>
                </div>
              </div>
              <div class="status">TRANSFER COMPLETED</div>
            </section>
            <section class="total">
              <p>TOTAL DEBIT</p>
              <h2>${escapeHtml(receiptMoney(receipt.totalDebit))}</h2>
            </section>
            <table>
              <tbody>
                ${rows
                  .map(
                    ([label, value]) =>
                      `<tr><td>${escapeHtml(label)}</td><td>${escapeHtml(String(value))}</td></tr>`
                  )
                  .join("")}
              </tbody>
            </table>
            <p class="footer">
              Generated digitally by ${escapeHtml(branding.bankName)}. This receipt confirms the transfer
              was approved through ${escapeHtml(branding.bankName)} Secure.
            </p>
          </main>
          <script>window.print();</script>
        </body>
      </html>
    `);
    receiptWindow.document.close();
    setReceiptNotice("Print receipt opened.");
  }

  async function completeVerifiedTransfer() {
    if (!pendingVerification) return;

    setStatus("");
    setVerificationError("");

    const latestRequest = getTransferVerificationRequest(pendingVerification.id);

    if (latestRequest?.status === "rejected") {
      setVerificationError("This transfer request was rejected by admin review.");
      return;
    }

    if (latestRequest?.status === "suspicious") {
      setVerificationError("This transfer is marked for suspicious activity review.");
      return;
    }

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
        routingNumber: pendingVerification.routingNumber,
        recipientAccountType: pendingVerification.recipientAccountType,
        swift: pendingVerification.swift,
        wallet: pendingVerification.wallet,
        memo: pendingVerification.memo,
        recipientAddress: pendingVerification.recipientAddress,
        wireCountry: pendingVerification.wireCountry,
        wireCurrency: pendingVerification.wireCurrency,
        transferPurpose: pendingVerification.transferPurpose,
        amount: pendingVerification.totalDebit ?? pendingVerification.amount,
        transferAmount:
          pendingVerification.transferAmount ??
          Math.max(
            (pendingVerification.totalDebit ?? pendingVerification.amount) -
              (pendingVerification.fee ?? 0),
            0
          ),
        fee: pendingVerification.fee ?? 0,
        totalDebit: pendingVerification.totalDebit ?? pendingVerification.amount,
        reference: pendingVerification.reference,
      });

      setStatus(result.message);

      if (result.ok) {
        const transactionId = `ARX-${pendingVerification.id.slice(-10).toUpperCase()}`;
        const receipt = createCompletedReceipt(pendingVerification, transactionId);

        completeTransferVerificationRequest(pendingVerification.id);
        setCompletedTransactionId(transactionId);
        setCompletedTransferTitle(receipt.transferTitle);
        setCompletedReceipt(receipt);
        setReceiptNotice("Receipt ready in PDF, print, and copy formats.");
        setPendingVerification(null);
        setVerificationCode("");
        setDraftReference(createTransferReference());
        setStep(6);
      }
    } catch {
      setStatus("Unable to complete transfer. Please check your connection and try again.");
    } finally {
      setLoading(false);
    }
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
                Secure Transfer System
              </p>
            </div>
            <h1 className="mt-4 text-4xl font-black tracking-tight lg:text-5xl">
              Send Money
            </h1>
            <p className="mt-3 max-w-3xl text-base leading-relaxed text-zinc-400">
              Choose the correct payment rail for Aurex accounts, local banks, international wires, or blockchain wallets.
            </p>
          </section>

          <div className="mb-6 grid gap-2 sm:grid-cols-4">
            {stepLabels.map((label, index) => {
              const stage = index + 1;
              const active = activeStage >= stage;

              return (
                <div
                  key={label}
                  className={`rounded-lg border px-3 py-3 text-xs font-black uppercase tracking-[0.16em] transition-all ${
                    active
                      ? "border-green-300/30 bg-green-400/10 text-green-300"
                      : "border-white/10 bg-white/[0.025] text-zinc-600"
                  }`}
                >
                  <span className="mr-2">{stage}</span>
                  {label}
                </div>
              );
            })}
          </div>

          {step === 1 && (
            <>
              <div className="grid min-w-0 gap-4 xl:grid-cols-4">
                {transferTypes.map((type) => (
                  <button
                    key={type.id}
                    type="button"
                    onClick={() => resetTransferDetails(type.id)}
                    className="bank-surface rounded-lg p-4 text-left transition-all hover:bg-white/[0.06] sm:p-5"
                  >
                    <div className="flex min-w-0 items-start justify-between gap-4">
                      <div className="flex h-11 w-11 items-center justify-center rounded-md bg-green-400/10 text-green-300">
                        <AppIcon name={type.icon} className="h-5 w-5" />
                      </div>
                      <span className="shrink-0 rounded-md border border-white/10 bg-white/[0.04] px-3 py-2 text-xs font-black text-zinc-300">
                        {type.timeline}
                      </span>
                    </div>
                    <h2 className="mt-4 break-words text-xl font-black">{type.title}</h2>
                    <p className="mt-1 break-words text-sm text-zinc-500">{type.desc}</p>
                    <div className="mt-4 grid grid-cols-2 gap-2 text-sm">
                      <div className="rounded-md border border-white/10 bg-white/[0.03] p-3">
                        <p className="text-xs text-zinc-500">Fee</p>
                        <p className="mt-1 break-words font-black">{type.feeLabel}</p>
                      </div>
                      <div className="rounded-md border border-white/10 bg-white/[0.03] p-3">
                        <p className="text-xs text-zinc-500">Rail</p>
                        <p className="mt-1 break-words font-black">{type.rail}</p>
                      </div>
                    </div>
                  </button>
                ))}
              </div>

              <section className="mt-6 grid min-w-0 gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(320px,380px)]">
                <div className="bank-surface rounded-lg p-5">
                  <div className="flex flex-col gap-5 md:flex-row md:items-start md:justify-between">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-green-400">Transfer Readiness</p>
                      <h2 className="mt-2 text-2xl font-black tracking-tight">
                        Choose a rail to continue
                      </h2>
                      <p className="mt-2 max-w-2xl text-sm leading-relaxed text-zinc-500">
                        Your primary checking account is ready for outgoing Aurex, local bank,
                        wire, and crypto transfers after secure review.
                      </p>
                    </div>
                    <div className="rounded-lg border border-green-300/15 bg-green-400/[0.07] p-4 md:min-w-[220px]">
                      <p className="text-xs font-black uppercase tracking-[0.14em] text-green-300">
                        Available
                      </p>
                      <h3 className="mt-2 text-3xl font-black">
                        <PrivateAmount value={accountOptions[0].amount} />
                      </h3>
                    </div>
                  </div>

                  <div className="mt-5 grid gap-3 sm:grid-cols-3">
                    {[
                      { label: "Status", value: normalizedAccountStatus },
                      { label: "Transfers", value: transferAvailability },
                      {
                        label: "Verification",
                        value:
                          verificationStatus === "approved"
                            ? "Approved"
                            : verificationStatus === "rejected"
                              ? "Rejected"
                              : "Pending review",
                      },
                    ].map((item, index) => (
                      <div key={`${item.label}-${index}`} className="rounded-lg border border-white/10 bg-black/20 p-4">
                        <p className="text-xs font-black uppercase tracking-[0.14em] text-zinc-500">
                          {item.label}
                        </p>
                        <p className="mt-2 break-words text-sm font-black text-white">
                          {item.value}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="bank-surface rounded-lg p-5">
                  <p className="text-sm font-semibold text-green-400">Recent Recipients</p>
                  <h2 className="mt-2 text-2xl font-black tracking-tight">
                    Faster next time
                  </h2>
                  <div className="mt-5 space-y-3">
                    {savedRecipients.length ? (
                      savedRecipients.slice(0, 3).map((savedRecipient) => (
                        <button
                          key={savedRecipient.id}
                          type="button"
                          onClick={() => {
                            applySavedRecipient(savedRecipient);
                            setStep(2);
                          }}
                          className="w-full rounded-lg border border-white/10 bg-white/[0.025] p-4 text-left transition-all hover:border-green-300/30 hover:bg-white/[0.055]"
                        >
                          <p className="truncate text-sm font-black text-white">
                            {savedRecipient.recipientName || savedRecipient.accountNumber || "Saved recipient"}
                          </p>
                          <p className="mt-1 truncate text-xs text-zinc-500">
                            {savedRecipient.bankName || savedRecipient.recipientContact || savedRecipient.transferType}
                          </p>
                        </button>
                      ))
                    ) : (
                      <div className="rounded-lg border border-white/10 bg-black/20 p-4 text-sm leading-relaxed text-zinc-500">
                        Saved recipients will appear here after your first completed details review.
                      </div>
                    )}
                  </div>
                </div>
              </section>
            </>
          )}

          {step >= 2 && step <= 4 && (
            <div
              className={`grid min-w-0 items-start gap-6 ${
                step === 2
                  ? "xl:grid-cols-1"
                  : "2xl:grid-cols-[minmax(0,1fr)_minmax(320px,380px)]"
              }`}
            >
              <div className="min-w-0 space-y-6">
                {step === 2 && (
                  <section className="bank-surface rounded-lg p-5 lg:p-6">
                    <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                      <div>
                        <p className="text-sm font-semibold text-green-400">{transfer.desc}</p>
                        <h2 className="mt-2 text-3xl font-black tracking-tight">Select Source Account</h2>
                        <p className="mt-3 max-w-3xl text-sm leading-relaxed text-zinc-500">
                          Choose the account that will fund this {transfer.title.toLowerCase()} transfer.
                          The detailed recipient form opens next.
                        </p>
                      </div>
                      <button
                        onClick={() => setStep(1)}
                        className="bank-button rounded-lg px-4 py-3 text-sm font-black"
                      >
                        Change Type
                      </button>
                    </div>

                    <div className="mt-5 grid min-w-0 items-start gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(300px,360px)]">
                      <div className="grid min-w-0 gap-4">
                        {accountOptions.map((account) => (
                          <article
                            key={account.value}
                            className="min-w-0 rounded-lg border border-green-300/20 bg-green-400/[0.07] p-5 text-left transition-all hover:border-green-300/35 hover:bg-green-400/[0.1]"
                          >
                            <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
                              <div className="min-w-0">
                                <div className="flex min-w-0 items-center gap-3">
                                  <p className="min-w-0 text-sm text-zinc-500">{account.title}</p>
                                  <BalancePrivacyToggle
                                    className="bank-button flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-zinc-300"
                                    iconClassName="h-4 w-4"
                                  />
                                </div>
                                <h3 className="mt-3 min-w-0 break-words text-3xl font-black sm:text-4xl">
                                  <PrivateAmount
                                    value={account.amount}
                                    maximumFractionDigits={0}
                                    minimumFractionDigits={0}
                                  />
                                </h3>
                              </div>
                              <button
                                type="button"
                                onClick={() => {
                                  setSelectedAccount(account.value);
                                  setStatus("");
                                  setStep(3);
                                }}
                                className="shrink-0 rounded-md bg-green-400 px-4 py-2.5 text-xs font-black text-black transition-all hover:bg-green-300"
                              >
                                Select
                              </button>
                            </div>
                            <p className="mt-5 max-w-2xl text-sm leading-relaxed text-zinc-500">
                              {account.meta}
                            </p>
                          </article>
                        ))}
                      </div>

                      <aside className="rounded-lg border border-white/10 bg-black/25 p-4">
                        <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between xl:flex-col">
                          <div>
                            <p className="text-sm font-semibold text-green-400">Selected Rail</p>
                            <h3 className="mt-2 text-2xl font-black tracking-tight">{transfer.rail}</h3>
                          </div>
                          <p className="max-w-xl text-sm leading-relaxed text-zinc-500 sm:text-right xl:text-left">
                            {transfer.features[0]}.
                          </p>
                        </div>
                        <div className="mt-4 grid gap-3 sm:grid-cols-3">
                          {[
                            { label: "Fee", value: transfer.feeLabel },
                            { label: "Delivery", value: transfer.timeline },
                            { label: "Limit", value: transfer.limit },
                          ].map((item, index) => (
                            <div
                              key={`${item.label}-${index}`}
                              className="min-w-0 rounded-lg border border-white/10 bg-white/[0.03] p-4"
                            >
                              <p className="text-xs font-black uppercase tracking-[0.14em] text-zinc-500">
                                {item.label}
                              </p>
                              <p className="mt-2 whitespace-normal text-xs font-black leading-tight text-white sm:text-[13px]">
                                {item.value}
                              </p>
                            </div>
                          ))}
                        </div>
                      </aside>
                    </div>
                  </section>
                )}

                {step === 3 && (
                  <section className="bank-surface rounded-lg p-6">
                    <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                      <div>
                        <p className="text-sm font-semibold text-green-400">{transfer.verification}</p>
                        <h2 className="mt-2 text-3xl font-black tracking-tight">Recipient Details</h2>
                      </div>
                      <div className="rounded-md border border-white/10 bg-white/[0.035] px-3 py-2 text-sm font-black text-zinc-300">
                        {transfer.limit}
                      </div>
                    </div>

                    {savedRecipients.length > 0 && (
                      <section className="mt-6 rounded-lg border border-green-300/15 bg-green-400/[0.06] p-4">
                        <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
                          <div>
                            <p className="text-sm font-semibold text-green-400">
                              Recent Recipients
                            </p>
                            <h3 className="mt-1 text-xl font-black">
                              {recipientSearchTerms.length
                                ? "Suggested matches"
                                : "Use a saved recipient"}
                            </h3>
                          </div>
                          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-zinc-500">
                            Local device
                          </p>
                        </div>

                        <div className="mt-4 grid gap-3 md:grid-cols-2">
                          {suggestedRecipients.length ? (
                            suggestedRecipients.map((savedRecipient) => {
                              const savedTransfer =
                                transferTypes.find(
                                  (item) => item.id === savedRecipient.transferType
                                ) ?? transferTypes[1];
                              const savedDestination =
                                savedRecipient.accountNumber ||
                                savedRecipient.wallet ||
                                savedRecipient.bankName ||
                                "Aurex recipient";

                              return (
                                <button
                                  key={savedRecipient.id}
                                  type="button"
                                  onClick={() => applySavedRecipient(savedRecipient)}
                                  className="min-w-0 rounded-lg border border-white/10 bg-black/25 p-4 text-left transition-all hover:border-green-300/30 hover:bg-black/35"
                                >
                                  <div className="flex min-w-0 items-start justify-between gap-3">
                                    <div className="min-w-0">
                                      <p className="truncate text-sm font-black text-white">
                                        {savedRecipient.recipientName || savedDestination}
                                      </p>
                                      <p className="mt-1 truncate text-xs text-zinc-500">
                                        {savedRecipient.recipientContact ||
                                          savedRecipient.bankName ||
                                          savedTransfer.rail}
                                      </p>
                                    </div>
                                    <span className="shrink-0 rounded-md border border-green-300/20 bg-green-400/10 px-2 py-1 text-[10px] font-black uppercase tracking-[0.12em] text-green-300">
                                      {savedTransfer.title}
                                    </span>
                                  </div>
                                  <p className="mt-3 truncate text-xs font-semibold text-zinc-400">
                                    {savedDestination}
                                    {savedRecipient.swift ? ` / ${savedRecipient.swift}` : ""}
                                  </p>
                                </button>
                              );
                            })
                          ) : (
                            <div className="rounded-lg border border-white/10 bg-black/20 p-4 text-sm font-semibold text-zinc-500 md:col-span-2">
                              No saved recipient matches that name, email, phone, bank, or account yet.
                            </div>
                          )}
                        </div>
                      </section>
                    )}

                    {selectedType === "internal" && (
                      <div className="mt-6 grid min-w-0 gap-5 lg:grid-cols-2">
                        <div>
                          <label className="text-sm text-zinc-500">Aurex Username or Email</label>
                          <input
                            type="text"
                            placeholder="customer@aurex or username"
                            value={recipient}
                            onChange={(event) => setRecipient(event.target.value)}
                            className="mt-3 w-full rounded-lg border border-white/10 bg-black/30 px-5 py-4 outline-none placeholder:text-zinc-600 focus:border-green-400/40"
                          />
                        </div>
                        <div className="rounded-lg border border-green-300/15 bg-green-400/[0.07] p-5">
                          <p className="text-sm font-semibold text-green-400">Internal Routing</p>
                          <h3 className="mt-2 text-2xl font-black">Instant Aurex Core</h3>
                          <p className="mt-3 text-sm leading-relaxed text-zinc-500">
                            Funds move between Aurex Bank profiles immediately after recipient confirmation.
                          </p>
                        </div>
                      </div>
                    )}

                    {selectedType === "bank" && (
                      <div className="mt-6 grid min-w-0 gap-5 lg:grid-cols-2">
                        <div>
                          <label className="text-sm text-zinc-500">Recipient Name</label>
                          <input
                            type="text"
                            placeholder="Legal account name"
                            value={recipient}
                            onChange={(event) => setRecipient(event.target.value)}
                            className="mt-3 w-full rounded-lg border border-white/10 bg-black/30 px-5 py-4 outline-none placeholder:text-zinc-600 focus:border-green-400/40"
                          />
                        </div>
                        <div>
                          <label className="text-sm text-zinc-500">Bank</label>
                          <input
                            type="text"
                            placeholder="Search local bank"
                            value={bankSearch}
                            onChange={(event) => setBankSearch(event.target.value)}
                            className="mt-3 w-full rounded-lg border border-white/10 bg-black/30 px-5 py-4 outline-none placeholder:text-zinc-600 focus:border-green-400/40"
                          />
                          {bankSearch && (
                            <div className="mt-3 overflow-hidden rounded-lg border border-white/10 bg-black">
                              {bankOptions
                                .filter((bank) => bank.toLowerCase().includes(bankSearch.toLowerCase()))
                                .map((bank) => (
                                  <button
                                    key={bank}
                                    type="button"
                                    onClick={() => setBankSearch(bank)}
                                    className="w-full px-5 py-4 text-left hover:bg-white/[0.05]"
                                  >
                                    {bank}
                                  </button>
                                ))}
                            </div>
                          )}
                        </div>
                        <div>
                          <label className="text-sm text-zinc-500">Recipient Account Type</label>
                          <select
                            value={recipientAccountType}
                            onChange={(event) => setRecipientAccountType(event.target.value)}
                            className="mt-3 w-full rounded-lg border border-white/10 bg-black/30 px-5 py-4 outline-none focus:border-green-400/40"
                          >
                            {recipientAccountTypes.map((type) => (
                              <option key={type} value={type}>
                                {type}
                              </option>
                            ))}
                          </select>
                        </div>
                        <div>
                          <label className="text-sm text-zinc-500">Account Number</label>
                          <input
                            type="text"
                            placeholder="0123456789"
                            value={accountNumber}
                            onChange={(event) =>
                              setAccountNumber(event.target.value.replace(/\D/g, "").slice(0, 18))
                            }
                            className="mt-3 w-full rounded-lg border border-white/10 bg-black/30 px-5 py-4 outline-none placeholder:text-zinc-600 focus:border-green-400/40"
                          />
                        </div>
                        <div>
                          <label className="text-sm text-zinc-500">Routing / Sort Code</label>
                          <input
                            type="text"
                            placeholder="021000021"
                            value={routingNumber}
                            onChange={(event) =>
                              setRoutingNumber(event.target.value.replace(/[^\d-]/g, "").slice(0, 12))
                            }
                            className="mt-3 w-full rounded-lg border border-white/10 bg-black/30 px-5 py-4 outline-none placeholder:text-zinc-600 focus:border-green-400/40"
                          />
                        </div>
                        <div className="lg:col-span-2">
                          <label className="text-sm text-zinc-500">
                            Recipient Email or Phone (optional)
                          </label>
                          <input
                            type="text"
                            placeholder="name@email.com or +1 555 0100"
                            value={recipientContact}
                            onChange={(event) => setRecipientContact(event.target.value.slice(0, 80))}
                            className="mt-3 w-full rounded-lg border border-white/10 bg-black/30 px-5 py-4 outline-none placeholder:text-zinc-600 focus:border-green-400/40"
                          />
                        </div>
                      </div>
                    )}

                    {selectedType === "wire" && (
                      <div className="mt-6 grid min-w-0 gap-5 lg:grid-cols-2">
                        <div>
                          <label className="text-sm text-zinc-500">Beneficiary Name</label>
                          <input
                            type="text"
                            placeholder="International recipient"
                            value={recipient}
                            onChange={(event) => setRecipient(event.target.value)}
                            className="mt-3 w-full rounded-lg border border-white/10 bg-black/30 px-5 py-4 outline-none placeholder:text-zinc-600 focus:border-green-400/40"
                          />
                        </div>
                        <div>
                          <label className="text-sm text-zinc-500">Beneficiary Address</label>
                          <input
                            type="text"
                            placeholder="Street, city, state"
                            value={recipientAddress}
                            onChange={(event) => setRecipientAddress(event.target.value)}
                            className="mt-3 w-full rounded-lg border border-white/10 bg-black/30 px-5 py-4 outline-none placeholder:text-zinc-600 focus:border-green-400/40"
                          />
                        </div>
                        <div>
                          <label className="text-sm text-zinc-500">Receiving Bank</label>
                          <input
                            type="text"
                            placeholder="Search international bank"
                            value={bankSearch}
                            onChange={(event) => setBankSearch(event.target.value)}
                            className="mt-3 w-full rounded-lg border border-white/10 bg-black/30 px-5 py-4 outline-none placeholder:text-zinc-600 focus:border-green-400/40"
                          />
                          {bankSearch && (
                            <div className="mt-3 overflow-hidden rounded-lg border border-white/10 bg-black">
                              {bankOptions
                                .filter((bank) => bank.toLowerCase().includes(bankSearch.toLowerCase()))
                                .map((bank) => (
                                  <button
                                    key={bank}
                                    type="button"
                                    onClick={() => setBankSearch(bank)}
                                    className="w-full px-5 py-4 text-left hover:bg-white/[0.05]"
                                  >
                                    {bank}
                                  </button>
                                ))}
                            </div>
                          )}
                        </div>
                        <div>
                          <label className="text-sm text-zinc-500">Beneficiary Country</label>
                          <select
                            value={wireCountry}
                            onChange={(event) => setWireCountry(event.target.value)}
                            className="mt-3 w-full rounded-lg border border-white/10 bg-black/30 px-5 py-4 outline-none focus:border-green-400/40"
                          >
                            {wireCountries.map((country) => (
                              <option key={country} value={country}>
                                {country}
                              </option>
                            ))}
                          </select>
                        </div>
                        <div>
                          <label className="text-sm text-zinc-500">
                            SWIFT / BIC <span className="text-green-300">(required for wire)</span>
                          </label>
                          <input
                            type="text"
                            placeholder="CHASUS33"
                            value={swift}
                            maxLength={11}
                            onChange={(event) =>
                              setSwift(
                                event.target.value
                                  .toUpperCase()
                                  .replace(/[^A-Z0-9]/g, "")
                                  .slice(0, 11)
                              )
                            }
                            className="mt-3 w-full rounded-lg border border-white/10 bg-black/30 px-5 py-4 outline-none placeholder:text-zinc-600 focus:border-green-400/40"
                          />
                          <p className="mt-2 text-xs font-semibold text-zinc-500">
                            Enter the receiving bank&apos;s 8 or 11 character SWIFT/BIC code.
                          </p>
                        </div>
                        <div>
                          <label className="text-sm text-zinc-500">IBAN or Account Number</label>
                          <input
                            type="text"
                            placeholder="IBAN / account number"
                            value={accountNumber}
                            onChange={(event) =>
                              setAccountNumber(event.target.value.toUpperCase().replace(/\s/g, "").slice(0, 34))
                            }
                            className="mt-3 w-full rounded-lg border border-white/10 bg-black/30 px-5 py-4 outline-none placeholder:text-zinc-600 focus:border-green-400/40"
                          />
                        </div>
                        <div>
                          <label className="text-sm text-zinc-500">Transfer Currency</label>
                          <select
                            value={wireCurrency}
                            onChange={(event) => setWireCurrency(event.target.value)}
                            className="mt-3 w-full rounded-lg border border-white/10 bg-black/30 px-5 py-4 outline-none focus:border-green-400/40"
                          >
                            {wireCurrencies.map((currency) => (
                              <option key={currency} value={currency}>
                                {currency}
                              </option>
                            ))}
                          </select>
                        </div>
                        <div>
                          <label className="text-sm text-zinc-500">Purpose of Payment</label>
                          <select
                            value={transferPurpose}
                            onChange={(event) => setTransferPurpose(event.target.value)}
                            className="mt-3 w-full rounded-lg border border-white/10 bg-black/30 px-5 py-4 outline-none focus:border-green-400/40"
                          >
                            {transferPurposes.map((purpose) => (
                              <option key={purpose} value={purpose}>
                                {purpose}
                              </option>
                            ))}
                          </select>
                        </div>
                      </div>
                    )}

                    {selectedType === "crypto" && (
                      <div className="mt-6 grid min-w-0 gap-5 lg:grid-cols-2">
                        <div>
                          <label className="text-sm text-zinc-500">Asset / Network</label>
                          <select
                            value={cryptoNetwork}
                            onChange={(event) => setCryptoNetwork(event.target.value)}
                            className="mt-3 w-full rounded-lg border border-white/10 bg-black/30 px-5 py-4 outline-none focus:border-green-400/40"
                          >
                            {cryptoNetworks.map((network) => (
                              <option key={network} value={network}>
                                {network}
                              </option>
                            ))}
                          </select>
                        </div>
                        <div>
                          <label className="text-sm text-zinc-500">Wallet Address</label>
                          <input
                            type="text"
                            placeholder="Paste wallet address"
                            value={wallet}
                            onChange={(event) => setWallet(event.target.value)}
                            className="mt-3 w-full rounded-lg border border-white/10 bg-black/30 px-5 py-4 outline-none placeholder:text-zinc-600 focus:border-green-400/40"
                          />
                        </div>
                      </div>
                    )}

                    {selectedType !== "crypto" && selectedType !== "bank" && (
                      <div className="mt-6">
                        <label className="text-sm text-zinc-500">
                          Recipient Email or Phone (optional)
                        </label>
                        <input
                          type="text"
                          placeholder="name@email.com or +1 555 0100"
                          value={recipientContact}
                          onChange={(event) => setRecipientContact(event.target.value.slice(0, 80))}
                          className="mt-3 w-full rounded-lg border border-white/10 bg-black/30 px-5 py-4 outline-none placeholder:text-zinc-600 focus:border-green-400/40"
                        />
                      </div>
                    )}

                    <div className="mt-6">
                      <label className="text-sm text-zinc-500">Note / Reference (optional)</label>
                      <input
                        type="text"
                        placeholder="Invoice, rent, family support"
                        value={memo}
                        onChange={(event) => setMemo(event.target.value.slice(0, 80))}
                        className="mt-3 w-full rounded-lg border border-white/10 bg-black/30 px-5 py-4 outline-none placeholder:text-zinc-600 focus:border-green-400/40"
                      />
                    </div>

                    <div className="mt-6">
                      <label className="text-sm text-zinc-500">Amount</label>
                      <input
                        type="number"
                        min="1"
                        step="0.01"
                        placeholder="$500"
                        value={amount}
                        onChange={(event) => setAmount(event.target.value)}
                        className="mt-3 w-full rounded-lg border border-white/10 bg-black/30 px-5 py-4 text-3xl font-black outline-none placeholder:text-zinc-700 focus:border-green-400/40 sm:text-4xl"
                      />
                    </div>

                    <div
                      className={`mt-6 rounded-lg border p-4 ${
                        canContinue
                          ? "border-green-400/15 bg-green-500/10"
                          : "border-yellow-300/20 bg-yellow-300/10"
                      }`}
                    >
                      <p
                        className={`text-sm font-black ${
                          canContinue ? "text-green-300" : "text-yellow-100"
                        }`}
                      >
                        {canContinue ? "Transfer ready for review" : "Complete these details"}
                      </p>
                      {canContinue ? (
                        <div className="mt-3 grid gap-2 text-sm text-zinc-300 sm:grid-cols-2">
                          <p className="break-words">
                            Recipient: <span className="font-black text-white">{destination}</span>
                          </p>
                          <p>
                            Total debit:{" "}
                            <span className="font-black text-white">
                              <PrivateAmount value={totalDebit} />
                            </span>
                          </p>
                          <p>
                            Source:{" "}
                            <span className="font-black text-white">
                              {selectedSourceAccount.title}
                            </span>
                          </p>
                          <p>
                            Balance after:{" "}
                            <span className="font-black text-white">
                              <PrivateAmount value={balanceAfter} />
                            </span>
                          </p>
                        </div>
                      ) : (
                        <ul className="mt-3 list-inside list-disc space-y-1 text-sm text-yellow-50/90">
                          {validationErrors.slice(0, 4).map((error) => (
                            <li key={error}>{error}</li>
                          ))}
                        </ul>
                      )}
                    </div>

                    {status && (
                      <div className="mt-4 rounded-lg border border-white/10 bg-white/[0.035] p-4 text-sm font-semibold text-zinc-300">
                        {status}
                      </div>
                    )}

                    <button
                      type="button"
                      onClick={continueToReview}
                      disabled={!canContinue || !validTransferAmount}
                      className="mt-7 w-full rounded-lg bg-green-400 py-4 text-sm font-black text-black transition-all hover:bg-green-300 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      Continue Transfer
                    </button>
                  </section>
                )}

                {step === 4 && (
                  <section className="bank-surface rounded-lg p-6">
                    <h2 className="text-3xl font-black tracking-tight">Transfer Review</h2>
                    <div className="mt-6 grid min-w-0 gap-4 lg:grid-cols-2">
                      {reviewDetails.map((item, index) => (
                        <div key={`${item.label}-${index}`} className="bank-panel rounded-lg p-5">
                          <p className="text-sm text-zinc-500">{item.label}</p>
                          <h3
                            className={`mt-3 break-words text-2xl font-black ${
                              item.green ? "text-green-400" : ""
                            }`}
                          >
                            {item.value}
                          </h3>
                        </div>
                      ))}
                    </div>

                    <div className="mt-6 rounded-lg border border-yellow-300/20 bg-yellow-300/10 p-4">
                      <p className="text-sm font-black text-yellow-100">Final bank review</p>
                      <p className="mt-2 text-sm leading-relaxed text-yellow-50/85">
                        Transfers may not be reversible after release. Confirm the recipient name,
                        bank or wallet, account number, amount, fee, and funding source before
                        continuing to secure verification.
                      </p>
                      <label className="mt-4 flex items-start gap-3 text-sm font-semibold text-zinc-200">
                        <input
                          type="checkbox"
                          checked={reviewAcknowledged}
                          onChange={(event) => setReviewAcknowledged(event.target.checked)}
                          className="mt-0.5 h-5 w-5 shrink-0 rounded border-white/20 bg-black/30 text-green-400 focus:ring-green-400"
                        />
                        <span>
                          I confirm these transfer details are correct and authorize Aurex Bank to
                          request final security approval.
                        </span>
                      </label>
                    </div>

                    <div className="mt-7 grid gap-3 sm:grid-cols-[auto_minmax(0,1fr)]">
                      <button
                        type="button"
                        onClick={() => {
                          setStatus("");
                          setStep(3);
                        }}
                        className="bank-button rounded-lg px-6 py-4 text-sm font-black"
                      >
                        Edit Details
                      </button>
                      <button
                        type="button"
                        onClick={handleTransfer}
                        disabled={loading || !reviewAcknowledged || validationErrors.length > 0}
                        className="rounded-lg bg-green-400 py-4 text-sm font-black text-black transition-all hover:bg-green-300 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        {loading ? "Requesting Code..." : "Request Secure Code"}
                      </button>
                    </div>
                    {status && (
                      <div className="mt-4 rounded-lg border border-white/10 bg-white/[0.035] p-4 text-sm font-semibold text-zinc-300">
                        {status}
                      </div>
                    )}
                  </section>
                )}
              </div>

              {step > 2 && (
              <div className="min-w-0 space-y-5">
                <section className="bank-surface rounded-lg p-5">
                  <p className="text-sm font-semibold text-green-400">Sender Account</p>
                  <h2 className="mt-3 break-words text-2xl font-black">
                    {currentProfile.fullName || currentProfile.username}
                  </h2>
                  <p className="mt-1 break-words text-sm text-zinc-500">
                    {currentProfile.username} / {selectedSourceAccount?.title ?? "Primary Checking"}
                  </p>
                  <div className="mt-5 rounded-lg border border-green-300/15 bg-green-400/[0.07] p-4">
                    <p className="text-xs font-black uppercase tracking-[0.14em] text-green-300">
                      Available Balance
                    </p>
                    <h3 className="mt-2 text-3xl font-black">
                      <PrivateAmount value={selectedSourceAccount?.amount ?? balance} />
                    </h3>
                  </div>
                  <div className="mt-5 grid gap-3">
                    {[
                      { label: "Account Status", value: normalizedAccountStatus },
                      { label: "Transfer Availability", value: transferAvailability },
                      {
                        label: "Verification",
                        value:
                          verificationStatus === "rejected"
                            ? "Rejected"
                            : verificationStatus === "approved"
                              ? "Approved"
                              : "Pending review",
                      },
                      { label: "Reference", value: transferReference },
                    ].map((item, index) => (
                      <div key={`${item.label}-${index}`} className="flex min-w-0 items-start justify-between gap-4">
                        <p className="min-w-0 text-sm text-zinc-500">{item.label}</p>
                        <h3 className="min-w-0 break-words text-right text-sm font-black text-zinc-100">
                          {item.value}
                        </h3>
                      </div>
                    ))}
                  </div>
                </section>

                <section className="bank-surface rounded-lg p-5">
                  <p className="text-sm font-semibold text-green-400">Transfer Summary</p>
                  <h2 className="mt-3 text-3xl font-black">
                    <PrivateAmount value={totalDebit} />
                  </h2>
                  <div className="mt-6 space-y-4">
                    {[
                      {
                        label: "Transfer Fee",
                        value:
                          transfer.feeLabel === "Gas" ? (
                            "Network gas"
                          ) : (
                            <PrivateAmount value={fee} />
                          ),
                      },
                      {
                        label: "Recipient Gets",
                        value: <PrivateAmount value={recipientGets} />,
                        green: true,
                      },
                      { label: "Transfer Type", value: transfer.title },
                      { label: "Delivery", value: transfer.timeline },
                      { label: "Limit", value: transfer.limit },
                    ].map((item: DetailItem, index) => (
                      <div key={`${item.label}-${index}`} className="flex min-w-0 items-start justify-between gap-4">
                        <p className="min-w-0 text-zinc-500">{item.label}</p>
                        <h3 className={`min-w-0 break-words text-right font-black ${item.green ? "text-green-400" : ""}`}>{item.value}</h3>
                      </div>
                    ))}
                  </div>
                </section>

                <section className="rounded-lg border border-green-300/15 bg-green-400/[0.07] p-5">
                  <p className="text-sm font-semibold text-green-400">Rail Details</p>
                  <h2 className="mt-2 text-2xl font-black tracking-tight">{transfer.rail}</h2>
                  <div className="mt-5 space-y-3">
                    {transfer.features.map((item) => (
                      <div key={item} className="flex items-center gap-3">
                        <span className="h-2.5 w-2.5 rounded-full bg-green-400" />
                        <p className="text-sm text-zinc-400">{item}</p>
                      </div>
                    ))}
                  </div>
                </section>
              </div>
              )}
            </div>
          )}

          {step === 5 && (
            <section className="mx-auto max-w-6xl overflow-hidden rounded-lg border border-green-300/15 bg-[linear-gradient(145deg,var(--brand-surface-strong),var(--brand-background))] p-5 shadow-[0_30px_100px_rgba(0,0,0,0.46)] lg:p-8">
              <div className="grid gap-6 lg:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)] lg:items-start">
                <div className="min-w-0">
                  <div className="flex h-16 w-16 items-center justify-center rounded-lg border border-green-300/20 bg-green-400/10 text-green-300">
                    <AppIcon name="shield" className="h-7 w-7" />
                  </div>
                  <p className="mt-6 text-sm font-semibold text-green-400">
                    Aurex Secure Verification
                  </p>
                  <h2 className="mt-2 text-4xl font-black tracking-tight">
                    Confirm Transfer
                  </h2>
                  <p className="mt-4 leading-relaxed text-zinc-400">
                    Review the debit, enter your approved 6 digit security code,
                    then release the transfer through Aurex Secure.
                  </p>

                  <div className="mt-6 rounded-lg border border-green-300/15 bg-green-400/[0.07] p-4">
                    <div className="flex items-center justify-between gap-4">
                      <div>
                        <p className="text-xs font-black uppercase tracking-[0.16em] text-green-300">
                          Security Status
                        </p>
                        <h3 className="mt-1 text-xl font-black">Protected session</h3>
                      </div>
                      <span className="rounded-md bg-green-400 px-3 py-2 text-xs font-black text-black">
                        Encrypted
                      </span>
                    </div>
                  </div>

                  <div className="mt-4 grid grid-cols-2 gap-3">
                    <button
                      type="button"
                      className="bank-button flex items-center justify-center gap-2 rounded-lg py-4 text-sm font-black"
                    >
                      <AppIcon name="profile" className="h-4 w-4" />
                      Face ID
                    </button>
                    <button
                      type="button"
                      className="bank-button flex items-center justify-center gap-2 rounded-lg py-4 text-sm font-black"
                    >
                      <AppIcon name="lock" className="h-4 w-4" />
                      Fingerprint
                    </button>
                  </div>

                  <div className="mt-4 rounded-lg border border-white/10 bg-black/25 p-4">
                    <div className="flex items-center justify-between gap-4">
                      <div>
                        <p className="text-xs font-black uppercase tracking-[0.16em] text-zinc-500">
                          Admin Code Status
                        </p>
                        <h3 className="mt-1 text-xl font-black">{secureStatusLabel}</h3>
                      </div>
                      <span className="rounded-md border border-green-300/15 bg-green-400/10 px-3 py-2 text-xs font-black text-green-300">
                        Live
                      </span>
                    </div>
                    <p className="mt-3 text-sm leading-relaxed text-zinc-500">
                      Use the six digit code from admin only after the request is activated.
                      If the admin marks the transfer rejected or suspicious, this page will stop it.
                    </p>
                  </div>

                  <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-1">
                    {secureChecklist.map((item) => (
                      <div
                        key={item}
                        className="flex items-center gap-3 rounded-lg border border-white/10 bg-white/[0.025] p-3"
                      >
                        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-green-400/10 text-green-300">
                          <AppIcon name="check" className="h-4 w-4" />
                        </span>
                        <p className="text-sm font-semibold text-zinc-300">{item}</p>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="min-w-0">
                  <div className="bank-panel rounded-lg p-5">
                    <p className="text-sm font-semibold text-green-400">Transfer Snapshot</p>
                    <div className="mt-5 grid min-w-0 gap-3">
                      {[
                        { label: "Recipient", value: pendingVerification?.receiver || "Pending" },
                        {
                          label: "Destination",
                          value:
                            pendingVerification?.bankName ||
                            pendingVerification?.accountNumber ||
                            pendingVerification?.wallet ||
                            "Aurex Secure",
                        },
                        {
                          label: "Amount",
                          value: <PrivateAmount value={pendingRecipientAmount} />,
                        },
                        { label: "Fee", value: <PrivateAmount value={pendingFee} /> },
                        {
                          label: "Total Debit",
                          value: <PrivateAmount value={pendingTotalDebit} />,
                          green: true,
                        },
                        { label: "Transfer Reference", value: transferReference },
                      ].map((item: DetailItem, index) => (
                        <div
                          key={`${item.label}-${index}`}
                          className="flex min-w-0 items-start justify-between gap-4 rounded-lg border border-white/10 bg-black/25 p-4"
                        >
                          <p className="min-w-0 text-sm text-zinc-500">{item.label}</p>
                          <h3
                            className={`min-w-0 break-words text-right font-black ${
                              item.green ? "text-green-400" : ""
                            }`}
                          >
                            {item.value}
                          </h3>
                        </div>
                      ))}
                    </div>
                  </div>

                  <label className="mt-5 block">
                    <span className="text-sm font-semibold text-zinc-400">
                      6 Digit Security Code
                    </span>
                    <div className="mt-3 overflow-hidden rounded-lg border border-white/10 bg-black/30 focus-within:border-green-400/40">
                      <input
                        type="password"
                        inputMode="numeric"
                        maxLength={6}
                        value={verificationCode}
                        onChange={(event) =>
                          setVerificationCode(event.target.value.replace(/\D/g, "").slice(0, 6))
                        }
                        placeholder="000000"
                        className="h-16 w-full min-w-0 bg-transparent px-5 text-center text-3xl font-black tracking-[0.35em] outline-none placeholder:text-zinc-700"
                      />
                    </div>
                  </label>

                  {verificationError && (
                    <div className="mt-4 rounded-lg border border-red-400/20 bg-red-500/10 p-4 text-sm font-semibold text-red-200">
                      {verificationError}
                    </div>
                  )}

                  {status && (
                    <div className="mt-4 rounded-lg border border-white/10 bg-white/[0.035] p-4 text-sm font-semibold text-zinc-300">
                      {status}
                    </div>
                  )}

                  <div className="mt-5 grid gap-3 sm:grid-cols-[auto_minmax(0,1fr)]">
                    <button
                      type="button"
                      onClick={() => setStep(4)}
                      className="bank-button rounded-lg px-6 py-4 text-sm font-black"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={completeVerifiedTransfer}
                      disabled={loading || verificationCode.length !== 6}
                      className="rounded-lg bg-green-400 px-6 py-4 text-sm font-black text-black transition-all hover:bg-green-300 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {loading ? "Verifying..." : "Confirm Transfer"}
                    </button>
                  </div>
                </div>
              </div>
            </section>
          )}

          {step === 6 && (
            <section className="bank-surface mx-auto max-w-6xl rounded-lg p-5 lg:p-6">
              <div className="grid gap-5 xl:grid-cols-2 xl:items-start">
                <div className="min-w-0 rounded-lg border border-green-300/15 bg-green-400/[0.07] p-5 text-left">
                  <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0">
                      <span className="inline-flex rounded-md bg-green-400 px-3 py-2 text-xs font-black uppercase tracking-[0.14em] text-black">
                        Completed
                      </span>
                      <h2 className="mt-4 text-3xl font-black text-green-300 sm:text-4xl">
                        Transfer Successful
                      </h2>
                      <p className="mt-3 text-sm leading-relaxed text-zinc-400">
                        Your {(completedTransferTitle || pendingTransferTitle).toLowerCase()} transfer is complete and the dashboard balance is updated.
                      </p>
                    </div>
                    <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full border border-green-400/20 bg-black/30 text-xl font-black text-green-300">
                      OK
                    </div>
                  </div>

                  {completedReceipt && (
                    <div className="mt-5 grid gap-3 sm:grid-cols-3">
                      {[
                        { label: "Amount Sent", value: receiptMoney(completedReceipt.amount) },
                        { label: "Fee", value: receiptMoney(completedReceipt.fee) },
                        { label: "Balance After", value: receiptMoney(completedReceipt.balanceAfter) },
                      ].map((item) => (
                        <div key={item.label} className="rounded-lg border border-white/10 bg-black/25 p-4">
                          <p className="text-[10px] font-black uppercase tracking-[0.14em] text-zinc-500">
                            {item.label}
                          </p>
                          <h3 className="mt-2 break-words text-lg font-black text-white">
                            {item.value}
                          </h3>
                        </div>
                      ))}
                    </div>
                  )}

                  <div className="mt-5 rounded-lg border border-white/10 bg-black/25 p-4">
                    <p className="text-xs font-black uppercase tracking-[0.14em] text-zinc-500">
                      Transaction ID
                    </p>
                    <h3 className="mt-2 break-all text-lg font-black">
                      {completedTransactionId || "ARX-VERIFIED"}
                    </h3>
                  </div>

                  {completedReceipt && (
                    <div className="mt-5 grid gap-3 sm:grid-cols-3">
                      <button
                        type="button"
                        onClick={() => downloadReceiptPdf(completedReceipt)}
                        className="rounded-lg bg-green-400 px-4 py-3 text-sm font-black text-black transition-all hover:bg-green-300"
                      >
                        Download PDF
                      </button>
                      <button
                        type="button"
                        onClick={() => printReceipt(completedReceipt)}
                        className="bank-button rounded-lg px-4 py-3 text-sm font-black"
                      >
                        Print / Save
                      </button>
                      <button
                        type="button"
                        onClick={() => void copyReceipt(completedReceipt)}
                        className="bank-button rounded-lg px-4 py-3 text-sm font-black"
                      >
                        Copy Details
                      </button>
                    </div>
                  )}

                  {receiptNotice && (
                    <div className="mt-4 rounded-lg border border-white/10 bg-white/[0.035] p-3 text-sm font-semibold text-zinc-300">
                      {receiptNotice}
                    </div>
                  )}
                </div>

                <div className="min-w-0 rounded-lg border border-white/10 bg-black/30 p-5 text-left shadow-[0_24px_80px_rgba(0,0,0,0.28)]">
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-green-400">Aurex Bank</p>
                      <h3 className="mt-2 text-3xl font-black tracking-tight">
                        Transfer Receipt
                      </h3>
                    </div>
                    <span className="rounded-md border border-green-300/20 bg-green-400/10 px-3 py-2 text-xs font-black uppercase tracking-[0.14em] text-green-300">
                      Paid
                    </span>
                  </div>

                  {completedReceipt ? (
                    <>
                      <div className="mt-5 rounded-lg border border-green-300/15 bg-green-400/[0.07] p-4">
                        <p className="text-xs font-black uppercase tracking-[0.16em] text-green-300">
                          Total Debit
                        </p>
                        <h3 className="mt-2 text-3xl font-black">
                          {receiptMoney(completedReceipt.totalDebit)}
                        </h3>
                      </div>

                      <div className="mt-4 grid min-w-0 gap-3 sm:grid-cols-2">
                        {buildReceiptRows(completedReceipt).map(([label, value]) => (
                          <div
                            key={label}
                            className="min-w-0 rounded-lg border border-white/10 bg-white/[0.025] p-3"
                          >
                            <p className="text-[10px] font-black uppercase tracking-[0.14em] text-zinc-500">
                              {label}
                            </p>
                            <h4 className="mt-2 break-words text-sm font-black text-white">
                              {value}
                            </h4>
                          </div>
                        ))}
                      </div>
                    </>
                  ) : (
                    <div className="mt-5 rounded-lg border border-white/10 bg-white/[0.025] p-5 text-sm text-zinc-500">
                      Receipt details are being prepared.
                    </div>
                  )}
                </div>
              </div>
            </section>
          )}

        </div>
      </div>

      <BottomNav />
    </main>
  );
}
