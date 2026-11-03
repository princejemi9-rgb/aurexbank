type OtpDelivery = {
  customerId: string;
  email?: string | null;
  challengeId: string;
  code: string;
  expiresAt: string;
  purpose: string;
};

function messageFor(purpose: string) {
  return purpose === "transfer_confirmation" ? "confirm your Aurex Bank transfer" : "confirm your Aurex Bank security request";
}

async function sendWithResend(payload: OtpDelivery) {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.AUREX_OTP_FROM_EMAIL;
  if (!apiKey || !from || !payload.email) return false;
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from,
      to: [payload.email],
      subject: "Your Aurex Bank verification code",
      text: `Your Aurex Bank code to ${messageFor(payload.purpose)} is ${payload.code}. It expires in 10 minutes. Do not share this code with anyone.`,
    }),
    cache: "no-store",
  });
  if (!response.ok) throw new Error("Verified email delivery failed.");
  return true;
}

export async function deliverOtp(payload: OtpDelivery) {
  if (await sendWithResend(payload)) return "verified_email";
  const endpoint = process.env.AUREX_OTP_DELIVERY_WEBHOOK;
  const secret = process.env.AUREX_OTP_DELIVERY_WEBHOOK_SECRET;
  if (!endpoint || !secret) throw new Error("OTP delivery is not configured. Configure Resend email or a verified delivery webhook.");
  const response = await fetch(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${secret}` },
    body: JSON.stringify(payload),
    cache: "no-store",
  });
  if (!response.ok) throw new Error("OTP delivery failed.");
  return "verified_channel";
}
