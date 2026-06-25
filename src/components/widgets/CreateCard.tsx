"use client";

import { supabase } from "../../lib/supabase";
import { useBanking } from "../../context/BankingContext";

export default function CreateCard() {
  const { currentProfile } = useBanking();

  function generateCardNumber() {

    return Array.from(
      { length: 16 },
      () =>
        Math.floor(Math.random() * 10)
    ).join("");

  }

  function generateCVV() {

    return Math.floor(
      100 + Math.random() * 900
    ).toString();

  }

  async function createCard() {

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) return;

    const username = currentProfile.username;

    const cardNumber =
      generateCardNumber();

    const cvv =
      generateCVV();

    const expiry = "09/30";

    const { error } =
      await supabase
        .from("cards")
        .insert([
          {
            username,
            card_number: cardNumber,
            expiry,
            cvv,
            balance: 5000,
          },
        ]);

    if (error) {

      alert(error.message);

    } else {

      alert("Virtual card created");

    }

  }

  return (
    <button
      onClick={createCard}
      className="w-full bg-green-500 hover:bg-green-400 transition text-black font-black py-4 rounded-2xl mt-6"
    >
      Generate Virtual Card
    </button>
  );
}
