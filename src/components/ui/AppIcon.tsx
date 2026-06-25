type AppIconName =
  | "admin"
  | "activity"
  | "back"
  | "bank"
  | "bell"
  | "card"
  | "check"
  | "crypto"
  | "dashboard"
  | "device"
  | "eye"
  | "eyeOff"
  | "help"
  | "lock"
  | "logout"
  | "more"
  | "pay"
  | "profile"
  | "receive"
  | "search"
  | "send"
  | "settings"
  | "shield"
  | "spark"
  | "wallet";

type AppIconProps = {
  name: AppIconName;
  className?: string;
};

const paths: Record<AppIconName, string[]> = {
  admin: ["M12 3 19 7v5c0 5-3 8-7 9-4-1-7-4-7-9V7l7-4Z", "M9 12l2 2 4-4"],
  activity: ["M4 12h4l2-7 4 14 2-7h4"],
  back: ["M19 12H5", "m12 5-7 7 7 7"],
  bank: ["M3 10h18L12 4 3 10Z", "M5 10v8", "M9 10v8", "M15 10v8", "M19 10v8", "M3 20h18"],
  bell: ["M15 17h5l-1.4-1.4A2 2 0 0 1 18 14.2V11a6 6 0 1 0-12 0v3.2c0 .53-.21 1.04-.59 1.41L4 17h11Z", "M9 17a3 3 0 0 0 6 0"],
  card: ["M3 7h18v10H3V7Z", "M3 10h18", "M7 15h4"],
  check: ["M20 6 9 17l-5-5"],
  crypto: ["M12 3v18", "M8 6h6a3 3 0 0 1 0 6H8", "M8 12h7a3 3 0 0 1 0 6H8", "M9 3v3", "M15 18v3"],
  dashboard: ["M4 5h7v7H4V5Z", "M13 5h7v4h-7V5Z", "M13 11h7v8h-7v-8Z", "M4 14h7v5H4v-5Z"],
  device: ["M7 4h10v14H7V4Z", "M10 21h4", "M12 17h.01"],
  eye: ["M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6-10-6-10-6Z", "M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z"],
  eyeOff: ["M3 3l18 18", "M10.6 10.6A3 3 0 0 0 13.4 13.4", "M9.9 5.2A11.6 11.6 0 0 1 12 5c6.5 0 10 7 10 7a18 18 0 0 1-3.1 4.2", "M6.6 6.6C3.6 8.2 2 12 2 12s3.5 7 10 7c1.5 0 2.9-.4 4.1-1"],
  help: ["M12 18h.01", "M9.5 9a2.5 2.5 0 1 1 4.1 1.92c-.86.58-1.6 1.19-1.6 2.58", "M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z"],
  lock: ["M7 10V8a5 5 0 0 1 10 0v2", "M5 10h14v10H5V10Z", "M12 14v2"],
  logout: ["M10 17l5-5-5-5", "M15 12H3", "M21 4v16"],
  more: ["M5 12h.01", "M12 12h.01", "M19 12h.01"],
  pay: ["M3 7h18v10H3V7Z", "M7 12h5", "M15 12h2", "M7 15h3"],
  profile: ["M20 21a8 8 0 0 0-16 0", "M12 13a5 5 0 1 0 0-10 5 5 0 0 0 0 10Z"],
  receive: ["M12 3v12", "m7 10 5 5 5-5", "M5 21h14"],
  search: ["m21 21-4.35-4.35", "M18 11a7 7 0 1 1-14 0 7 7 0 0 1 14 0Z"],
  send: ["M22 2 11 13", "M22 2 15 22l-4-9-9-4 20-7Z"],
  settings: ["M12 15.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7Z", "M19.4 15a1.7 1.7 0 0 0 .34 1.87l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06A1.7 1.7 0 0 0 15 19.4a1.7 1.7 0 0 0-1 .6V20a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1-.5 1.7 1.7 0 0 0-1.87.34l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.7 1.7 0 0 0 4.6 15a1.7 1.7 0 0 0-.6-1H4a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 .5-1 1.7 1.7 0 0 0-.34-1.87l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.7 1.7 0 0 0 9 4.6a1.7 1.7 0 0 0 1-.6V4a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 .5 1.7 1.7 0 0 0 1.87-.34l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.7 1.7 0 0 0 19.4 9c.2.36.4.7.6 1H20a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-.5 1Z"],
  shield: ["M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10Z", "m9 12 2 2 4-5"],
  spark: ["M12 2v5", "M12 17v5", "M4.22 4.22l3.54 3.54", "M16.24 16.24l3.54 3.54", "M2 12h5", "M17 12h5", "M4.22 19.78l3.54-3.54", "M16.24 7.76l3.54-3.54"],
  wallet: ["M3 7h16a2 2 0 0 1 2 2v9H3V7Z", "M3 7V5a2 2 0 0 1 2-2h12v4", "M16 13h2"],
};

export default function AppIcon({ name, className = "h-5 w-5" }: AppIconProps) {
  return (
    <svg
      aria-hidden="true"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="2"
      viewBox="0 0 24 24"
    >
      {paths[name].map((path) => (
        <path d={path} key={path} />
      ))}
    </svg>
  );
}
