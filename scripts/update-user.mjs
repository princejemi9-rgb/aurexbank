#!/usr/bin/env node
// Update a Supabase user's email, name, phone and KYC metadata using the
// service role key. Run with environment variables set (see usage below).

import { createClient } from "@supabase/supabase-js";
import fs from "fs";
import path from "path";

function showUsageAndExit() {
  console.log("Usage: set environment variables and run: node scripts/update-user.mjs");
  console.log("\nRequired env vars:");
  console.log("  SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, TARGET_EMAIL, NEW_EMAIL");
  console.log("Optional:");
  console.log("  NEW_FULL_NAME (default: Donald), NEW_PHONE (default: +1 555 555 0123)");
  process.exit(1);
}

// Attempt to load .env.local automatically if present and env vars are missing
function loadLocalEnv() {
  try {
    const file = path.resolve(process.cwd(), ".env.local");
    if (!fs.existsSync(file)) return;
    const text = fs.readFileSync(file, "utf8");
    text.split(/\r?\n/).forEach((line) => {
      const m = line.match(/^\s*([A-Z0-9_]+)=(.*)$/i);
      if (!m) return;
      const key = m[1];
      let val = m[2] || "";
      // strip surrounding quotes
      if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
        val = val.slice(1, -1);
      }
      if (!process.env[key]) process.env[key] = val;
    });
  } catch {
    // ignore
  }
}

loadLocalEnv();

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const serviceRoleKey =
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SECRET_KEY;

const targetEmail = process.env.TARGET_EMAIL || process.env.OLD_EMAIL;
const newEmail = process.env.NEW_EMAIL;
const newFullName = process.env.NEW_FULL_NAME || "Donald";
const newPhone = process.env.NEW_PHONE || "+1-555-555-0123";

if (!supabaseUrl || !serviceRoleKey || !targetEmail || !newEmail) {
  showUsageAndExit();
}

const client = createClient(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

async function findUserByEmail(email) {
  // Try listing auth users (requires service role key)
  let page = 1;
  while (page <= 10) {
    // supabase-js admin.listUsers returns { data }
    const res = await client.auth.admin.listUsers({ page, perPage: 100 });
    const users = res.data?.users || [];
    const found = users.find((u) => (u.email || "").toLowerCase() === email.toLowerCase());
    if (found) return found;
    if (!users.length || users.length < 100) break;
    page += 1;
  }

  // fallback: try to look up profile table for matching username
  try {
    const { data: profile } = await client
      .from("profiles")
      .select("username")
      .eq("username", email)
      .limit(1)
      .maybeSingle();

    if (profile?.username) {
      // try again to find a user whose user_metadata.username matches
      page = 1;
      while (page <= 10) {
        const res = await client.auth.admin.listUsers({ page, perPage: 100 });
        const users = res.data?.users || [];
        const found = users.find(
          (u) => ((u.user_metadata && u.user_metadata.username) || "").toLowerCase() === profile.username.toLowerCase()
        );
        if (found) return found;
        if (!users.length || users.length < 100) break;
        page += 1;
      }
    }
  } catch {
    // ignore
  }

  return null;
}

async function run() {
  console.log(`Looking for user with email: ${targetEmail}`);
  const user = await findUserByEmail(targetEmail);

  if (!user) {
    console.log("No auth user found — checking profiles table for a profile-only record...");
    const { data: profile } = await client
      .from("profiles")
      .select("username,balance")
      .eq("username", targetEmail)
      .limit(1)
      .maybeSingle();

    if (!profile) {
      console.error("No auth user or profile record found. Aborting.");
      process.exit(2);
    }

    console.log("Profile-only record found. Creating an auth user and migrating the profile username...");

    // build metadata for new user
    const [firstName, ...rest] = newFullName.split(" ");
    const lastName = rest.join(" ");
    const nextMetadata = {
      first_name: firstName || newFullName,
      last_name: lastName || "",
      full_name: newFullName,
      username: newEmail,
      phone: newPhone,
      country: "United States",
      identity: true,
      contact: true,
      address: true,
      biometrics: true,
      submitted: true,
      verified: true,
      admin_updated_at: new Date().toISOString(),
    };

    // generate a random strong temporary password
    const tempPassword = `Tmp!${Math.random().toString(36).slice(2)}A0`;

    const { data: createdUser, error: createErr } = await client.auth.admin.createUser({
      email: newEmail,
      password: tempPassword,
      email_confirm: true,
      user_metadata: nextMetadata,
    }).catch((e) => ({ data: null, error: e }));

    if (createErr || !createdUser) {
      console.error("Failed to create auth user:", createErr?.message || createErr);
      process.exit(4);
    }

    console.log(`Created auth user id=${createdUser.id} email=${createdUser.email}`);

    // update profiles table username to new email
    try {
      const { error: upsertErr } = await client
        .from("profiles")
        .update({ username: newEmail })
        .eq("username", targetEmail)
        .throwOnError();

      if (upsertErr) {
        console.warn("Warning: failed to update profiles table:", upsertErr.message || upsertErr);
      } else {
        console.log("Profiles table username updated to:", newEmail);
      }
    } catch (e) {
      console.warn("Warning updating profiles table:", e instanceof Error ? e.message : e);
    }

    console.log("Done creating auth user. A temporary password was generated — share it securely with the user if needed.");
    process.exit(0);
  }

  console.log(`Found user id=${user.id} email=${user.email}`);

  const [firstName, ...rest] = newFullName.split(" ");
  const lastName = rest.join(" ");

  const currentMetadata = (user.user_metadata && typeof user.user_metadata === "object") ? user.user_metadata : {};

  const nextMetadata = {
    ...currentMetadata,
    username: newEmail,
    first_name: firstName || newFullName,
    last_name: lastName || "",
    full_name: newFullName,
    phone: newPhone,
    country: "United States",
    // KYC flags to mirror admin-verified state
    identity: true,
    contact: true,
    address: true,
    biometrics: true,
    submitted: true,
    verified: true,
    admin_updated_at: new Date().toISOString(),
  };

  console.log("Updating user email and metadata...");

  const { error: updateErr } = await client.auth.admin.updateUserById(user.id, {
    email: newEmail,
    user_metadata: nextMetadata,
  });

  if (updateErr) {
    console.error("Failed to update user:", updateErr.message || updateErr);
    process.exit(3);
  }

  console.log("User updated via auth admin API.");

  // Ensure profiles table has a matching profile record for username
  try {
    const resolvedUsername = (nextMetadata.username || newEmail).toLowerCase();
    const { data: existingProfile } = await client
      .from("profiles")
      .select("username,balance")
      .eq("username", resolvedUsername)
      .limit(1)
      .maybeSingle();

    const balance = (existingProfile && existingProfile.balance) || 0;

    await client.from("profiles").upsert({ username: resolvedUsername, balance }, { onConflict: "username" });
    console.log("Profiles table upserted for username:", resolvedUsername);
  } catch (err) {
    console.warn("Warning: unable to upsert profiles table:", err instanceof Error ? err.message : err);
  }

  console.log("Done. Verify the admin UI or run the app to confirm changes.");
}

run().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(99);
});
