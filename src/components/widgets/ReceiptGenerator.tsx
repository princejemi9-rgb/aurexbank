"use client";

import jsPDF from "jspdf";
import { useBranding } from "../../context/BrandingContext";

export default function ReceiptGenerator() {
  const { branding } = useBranding();

  function generateReceipt() {

    const doc = new jsPDF();

    doc.setFontSize(22);

    doc.text(
      `${branding.bankName} Receipt`,
      20,
      30
    );

    doc.setFontSize(14);

    doc.text(
      "Transaction Successful",
      20,
      50
    );

    doc.text(
      `Bank: ${branding.bankName}`,
      20,
      70
    );

    doc.text(
      "Status: Completed",
      20,
      85
    );

    doc.text(
      "Generated digitally",
      20,
      100
    );

    doc.save(
      `${branding.bankName.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-receipt.pdf`
    );

  }

  return (
    <button
      onClick={generateReceipt}
      className="w-full bg-green-500 hover:bg-green-400 transition text-black font-black py-4 rounded-2xl mt-6"
    >
      Download Receipt
    </button>
  );
}
