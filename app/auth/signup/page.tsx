"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabase } from "../../../src/lib/supabase";
import AurexBrand from "../../../src/components/brand/AurexBrand";
import AppIcon from "../../../src/components/ui/AppIcon";

type FormStep = "account" | "personal" | "address" | "kyc" | "complete";

export default function SignUpPage() {
  const router = useRouter();
  const [step, setStep] = useState<FormStep>("account");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  useEffect(() => {
    let mounted = true;
    const checkSession = async () => {
      const { data } = await supabase.auth.getSession();
      if (!mounted) return;
      if (data.session) {
        router.replace("/dashboard");
      }
    };

    checkSession();

    return () => {
      mounted = false;
    };
  }, [router]);

  // Form state - comprehensive bank account details
  const [formData, setFormData] = useState({
    // Account credentials
    email: "",
    password: "",
    confirmPassword: "",

    // Personal information
    firstName: "",
    middleName: "",
    lastName: "",
    phone: "",
    dateOfBirth: "",
    placeOfBirth: "",
    nationality: "",

    // Address information
    address: "",
    apartment: "",
    city: "",
    state: "",
    postalCode: "",
    country: "",

    // KYC / Compliance information
    idType: "",
    idNumber: "",
    idExpiry: "",
    idIssuingCountry: "",
    occupation: "",
    employer: "",
    annualIncome: "",
    sourceOfFunds: "",

    // Account preferences
    accountType: "personal",
    currency: "USD",
    agreeToTerms: false,
    agreeToPrivacy: false,
    marketingOptIn: false,
  });

  const updateForm = (
    field: keyof typeof formData,
    value: (typeof formData)[keyof typeof formData]
  ) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const validateAccountStep = () => {
    if (!formData.email || !formData.email.includes("@")) {
      setError("Please enter a valid email address");
      return false;
    }
    if (!formData.password || formData.password.length < 10) {
      setError("Password must be at least 10 characters with uppercase, lowercase, and numbers");
      return false;
    }
    if (!/(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/.test(formData.password)) {
      setError("Password must contain at least one uppercase letter, one lowercase letter, and one number");
      return false;
    }
    if (formData.password !== formData.confirmPassword) {
      setError("Passwords do not match");
      return false;
    }
    return true;
  };

  const validatePersonalStep = () => {
    if (!formData.firstName || !formData.lastName) {
      setError("Please enter your first and last name");
      return false;
    }
    if (!formData.phone || formData.phone.length < 10) {
      setError("Please enter a valid phone number");
      return false;
    }
    if (!formData.dateOfBirth) {
      setError("Please enter your date of birth");
      return false;
    }

    const birthDate = new Date(formData.dateOfBirth);
    const today = new Date();
    const age = Math.floor(
      (today.getTime() - birthDate.getTime()) / (365.25 * 24 * 60 * 60 * 1000)
    );

    if (age < 18) {
      setError("You must be at least 18 years old to open an account");
      return false;
    }

    if (!formData.nationality) {
      setError("Please select your nationality");
      return false;
    }

    return true;
  };

  const validateAddressStep = () => {
    if (!formData.address) {
      setError("Please enter your street address");
      return false;
    }
    if (!formData.city) {
      setError("Please enter your city");
      return false;
    }
    if (!formData.state) {
      setError("Please enter your state/province");
      return false;
    }
    if (!formData.postalCode) {
      setError("Please enter your postal/ZIP code");
      return false;
    }
    if (!formData.country) {
      setError("Please select your country of residence");
      return false;
    }
    return true;
  };

  const validateKycStep = () => {
    if (!formData.idType) {
      setError("Please select an identification type");
      return false;
    }
    if (!formData.idNumber) {
      setError("Please enter your ID number");
      return false;
    }
    if (!formData.occupation) {
      setError("Please select your occupation");
      return false;
    }
    if (!formData.annualIncome) {
      setError("Please select your annual income range");
      return false;
    }
    if (!formData.agreeToTerms) {
      setError("Please agree to the Terms of Service");
      return false;
    }
    if (!formData.agreeToPrivacy) {
      setError("Please agree to the Privacy Policy");
      return false;
    }
    return true;
  };

  const handleNext = () => {
    setError("");
    switch (step) {
      case "account":
        if (validateAccountStep()) setStep("personal");
        break;
      case "personal":
        if (validatePersonalStep()) setStep("address");
        break;
      case "address":
        if (validateAddressStep()) setStep("kyc");
        break;
      case "kyc":
        if (validateKycStep()) handleSignUp();
        break;
    }
  };

  const handlePrevious = () => {
    setError("");
    switch (step) {
      case "personal":
        setStep("account");
        break;
      case "address":
        setStep("personal");
        break;
      case "kyc":
        setStep("address");
        break;
    }
  };

  const getFullName = () => `${formData.firstName} ${formData.lastName}`.trim();

  const getBaseMetadata = (kycSkipped = false) => ({
    username: formData.email.trim().toLowerCase(),
    first_name: formData.firstName,
    middle_name: formData.middleName,
    last_name: formData.lastName,
    full_name: getFullName(),
    phone: formData.phone,
    country: formData.country,
    account_type: formData.accountType,
    currency: formData.currency,
    balance: 0,
    reserve: 0,
    income: 0,
    account_status: "active",
    transfer_frozen: false,
    verification_status: "pending",
    kyc_status: "pending",
    kyc_skipped: kycSkipped,
  });

  const onboardCreatedUser = async (userId: string) => {
    await fetch("/api/auth/onboard", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        userId,
        email: formData.email,
        firstName: formData.firstName,
        lastName: formData.lastName,
        fullName: getFullName(),
        phone: formData.phone,
        country: formData.country,
      }),
    }).catch(() => null);
  };

  const handleSignUp = async () => {
    setLoading(true);
    setError("");

    try {
      const { data, error: signUpError } = await supabase.auth.signUp({
        email: formData.email,
        password: formData.password,
        options: {
          data: {
            ...getBaseMetadata(false),
            date_of_birth: formData.dateOfBirth,
            place_of_birth: formData.placeOfBirth,
            nationality: formData.nationality,
            address: formData.address,
            apartment: formData.apartment,
            city: formData.city,
            state: formData.state,
            postal_code: formData.postalCode,
            country: formData.country,
            id_type: formData.idType,
            id_number: formData.idNumber,
            id_expiry: formData.idExpiry,
            id_issuing_country: formData.idIssuingCountry,
            occupation: formData.occupation,
            employer: formData.employer,
            annual_income: formData.annualIncome,
            source_of_funds: formData.sourceOfFunds,
          },
        },
      });

      if (signUpError) {
        setError(signUpError.message);
        setLoading(false);
        return;
      }

      if (data.user) {
        await onboardCreatedUser(data.user.id);
        setStep("complete");
        setSuccess(
          "Account created successfully! Please verify your email to activate your account."
        );
      }
    } catch {
      setError("Failed to create account. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleSkipKyc = async () => {
    setLoading(true);
    setError("");

    try {
      const { data, error: signUpError } = await supabase.auth.signUp({
        email: formData.email,
        password: formData.password,
        options: {
          data: {
            ...getBaseMetadata(true),
          },
        },
      });

      if (signUpError) {
        setError(signUpError.message);
        setLoading(false);
        return;
      }

      if (data.user) {
        await onboardCreatedUser(data.user.id);
        setStep("complete");
        setSuccess(
          "Account created. You can complete identity verification later in Settings."
        );
      }
    } catch {
      setError("Failed to create account. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const getPasswordStrength = () => {
    const password = formData.password;
    let strength = 0;
    if (password.length >= 10) strength++;
    if (password.length >= 14) strength++;
    if (/[A-Z]/.test(password)) strength++;
    if (/[a-z]/.test(password)) strength++;
    if (/[0-9]/.test(password)) strength++;
    if (/[^A-Za-z0-9]/.test(password)) strength++;
    return Math.min(strength, 5);
  };

  const passwordStrength = getPasswordStrength();

  const steps = [
    { id: "account", label: "Account" },
    { id: "personal", label: "Personal" },
    { id: "address", label: "Address" },
    { id: "kyc", label: "Verification" },
  ];

  const currentStepIndex = steps.findIndex((s) => s.id === step);

  return (
    <main className="relative min-h-screen overflow-hidden bg-black text-white">
      {/* GRID */}
      <div className="relative z-10 grid min-h-screen min-w-0 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
        {/* LEFT SIDE - Form */}
        <section className="flex items-center justify-center px-5 py-10 lg:px-10 order-2 lg:order-1">
          <div className="w-full max-w-lg">
            <div className="bg-white/[0.04] border border-white/10 backdrop-blur-2xl rounded-lg p-8 shadow-2xl">
              {/* HEADER */}
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="w-2.5 h-2.5 rounded-full bg-green-400 animate-pulse" />
                  <p className="text-green-400 text-xs uppercase tracking-[0.25em] font-semibold">
                    {step === "complete" ? "Account Created" : "Create Your Account"}
                  </p>
                </div>

                <Link
                  href="/login"
                  className="text-sm text-green-400 font-medium hover:text-green-300 transition-all"
                >
                  Already have an account?
                </Link>
              </div>

              <h2 className="text-3xl font-black mt-6 tracking-tight">
                {step === "complete"
                  ? "Verify Your Email"
                  : step === "account"
                  ? "Account Details"
                  : step === "personal"
                  ? "Personal Information"
                  : step === "address"
                  ? "Address Details"
                  : "Identity Verification"}
              </h2>

              <p className="text-zinc-500 mt-4 leading-relaxed">
                {step === "account"
                  ? "Create your secure Aurex Bank account credentials."
                  : step === "personal"
                  ? "Tell us about yourself for account verification."
                  : step === "address"
                  ? "Provide your residential address for compliance."
                  : step === "kyc"
                  ? "Complete identity verification for full account access."
                  : "Check your email to activate your account."}
              </p>

              {/* PROGRESS STEPS */}
              {step !== "complete" && (
                <div className="flex items-center gap-2 mt-8">
                  {steps.map((s, i) => (
                    <div
                      key={s.id}
                      className="flex items-center flex-1 min-w-0"
                    >
                      <div
                        className={`h-2 w-full rounded-full transition-all duration-500 ${
                          i <= currentStepIndex ? "bg-green-400" : "bg-white/10"
                        }`}
                      />
                      {i < steps.length - 1 && (
                        <div
                          className={`h-[2px] flex-1 mx-2 ${
                            i < currentStepIndex ? "bg-green-400" : "bg-white/10"
                          }`}
                        />
                      )}
                    </div>
                  ))}
                </div>
              )}

              {/* FORM CONTENT */}
              <div className="mt-8">
                {step === "account" && (
                  <div className="space-y-5">
                    <div>
                      <label className="text-sm text-zinc-400 font-medium">
                        Email Address
                      </label>
                      <input
                        type="email"
                        title="Email Address"
                        value={formData.email}
                        onChange={(e) => updateForm("email", e.target.value)}
                        placeholder="you@example.com"
                        className="w-full mt-2 h-14 rounded-2xl bg-black/30 border border-white/10 px-5 outline-none focus:border-green-400 transition-all"
                      />
                    </div>

                    <div>
                      <label className="text-sm text-zinc-400 font-medium">
                        Password
                      </label>
                      <input
                        type="password"
                        value={formData.password}
                        onChange={(e) => updateForm("password", e.target.value)}
                        placeholder="Create a strong password"
                        className="w-full mt-2 h-14 rounded-2xl bg-black/30 border border-white/10 px-5 outline-none focus:border-green-400 transition-all"
                      />
                      {formData.password && (
                        <div className="flex gap-1 mt-3">
                          {[1, 2, 3, 4, 5].map((i) => (
                            <div
                              key={i}
                              className={`h-1 flex-1 rounded-full transition-all ${
                                i <= passwordStrength
                                  ? passwordStrength <= 2
                                    ? "bg-red-400"
                                    : passwordStrength <= 3
                                    ? "bg-yellow-400"
                                    : "bg-green-400"
                                  : "bg-white/10"
                              }`}
                            />
                          ))}
                        </div>
                      )}
                      <p className="text-xs text-zinc-500 mt-2">
                        Must be 10+ characters with uppercase, lowercase, and numbers
                      </p>
                    </div>

                    <div>
                      <label className="text-sm text-zinc-400 font-medium">
                        Confirm Password
                      </label>
                      <input
                        type="password"
                        value={formData.confirmPassword}
                        onChange={(e) =>
                          updateForm("confirmPassword", e.target.value)
                        }
                        placeholder="Confirm your password"
                        className="w-full mt-2 h-14 rounded-2xl bg-black/30 border border-white/10 px-5 outline-none focus:border-green-400 transition-all"
                      />
                    </div>

                    {error && (
                      <div className="rounded-2xl border border-red-500/20 bg-red-500/10 p-4 text-sm text-red-300">
                        {error}
                      </div>
                    )}

                    <button
                      onClick={handleNext}
                      disabled={loading}
                      className="w-full h-14 rounded-2xl bg-green-400 text-black font-black text-lg hover:bg-green-300 transition-all disabled:opacity-50"
                    >
                      Continue
                    </button>
                  </div>
                )}

                {step === "personal" && (
                  <div className="space-y-5">
                    <div className="grid grid-cols-3 gap-4">
                      <div className="col-span-2">
                        <label className="text-sm text-zinc-400 font-medium">
                          First Name
                        </label>
                        <input
                          type="text"
                          value={formData.firstName}
                          onChange={(e) =>
                            updateForm("firstName", e.target.value)
                          }
                          placeholder="John"
                          className="w-full mt-2 h-14 rounded-2xl bg-black/30 border border-white/10 px-5 outline-none focus:border-green-400 transition-all"
                        />
                      </div>
                      <div>
                        <label className="text-sm text-zinc-400 font-medium">
                          Middle Name
                        </label>
                        <input
                          type="text"
                          value={formData.middleName}
                          onChange={(e) =>
                            updateForm("middleName", e.target.value)
                          }
                          placeholder="Optional"
                          className="w-full mt-2 h-14 rounded-2xl bg-black/30 border border-white/10 px-5 outline-none focus:border-green-400 transition-all"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="text-sm text-zinc-400 font-medium">
                        Last Name
                      </label>
                      <input
                        type="text"
                        value={formData.lastName}
                        onChange={(e) =>
                          updateForm("lastName", e.target.value)
                        }
                        placeholder="Doe"
                        className="w-full mt-2 h-14 rounded-2xl bg-black/30 border border-white/10 px-5 outline-none focus:border-green-400 transition-all"
                      />
                    </div>

                    <div>
                      <label className="text-sm text-zinc-400 font-medium">
                        Phone Number
                      </label>
                      <input
                        type="tel"
                        value={formData.phone}
                        onChange={(e) => updateForm("phone", e.target.value)}
                        placeholder="+1 (555) 000-0000"
                        className="w-full mt-2 h-14 rounded-2xl bg-black/30 border border-white/10 px-5 outline-none focus:border-green-400 transition-all"
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="text-sm text-zinc-400 font-medium">
                          Date of Birth
                        </label>
                        <input
                          type="date"
                          value={formData.dateOfBirth}
                          onChange={(e) =>
                            updateForm("dateOfBirth", e.target.value)
                          }
                          className="w-full mt-2 h-14 rounded-2xl bg-black/30 border border-white/10 px-5 outline-none focus:border-green-400 transition-all text-zinc-400"
                        />
                      </div>
                      <div>
                        <label className="text-sm text-zinc-400 font-medium">
                          Place of Birth
                        </label>
                        <input
                          type="text"
                          value={formData.placeOfBirth}
                          onChange={(e) =>
                            updateForm("placeOfBirth", e.target.value)
                          }
                          placeholder="City, Country"
                          className="w-full mt-2 h-14 rounded-2xl bg-black/30 border border-white/10 px-5 outline-none focus:border-green-400 transition-all"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="text-sm text-zinc-400 font-medium">
                        Nationality
                      </label>
                      <select
                        value={formData.nationality}
                        onChange={(e) =>
                          updateForm("nationality", e.target.value)
                        }
                        className="w-full mt-2 h-14 rounded-2xl bg-black/30 border border-white/10 px-5 outline-none focus:border-green-400 transition-all text-zinc-400"
                      >
                        <option value="">Select nationality</option>
                        <option value="US">United States</option>
                        <option value="UK">United Kingdom</option>
                        <option value="CA">Canada</option>
                        <option value="NG">Nigeria</option>
                        <option value="AU">Australia</option>
                        <option value="DE">Germany</option>
                        <option value="FR">France</option>
                        <option value="other">Other</option>
                      </select>
                    </div>

                    {error && (
                      <div className="rounded-2xl border border-red-500/20 bg-red-500/10 p-4 text-sm text-red-300">
                        {error}
                      </div>
                    )}

                    <div className="flex gap-4">
                      <button
                        onClick={handlePrevious}
                        className="flex-1 h-14 rounded-2xl border border-white/10 bg-white/[0.05] font-black hover:bg-white/[0.08] transition-all"
                      >
                        Back
                      </button>
                      <button
                        onClick={handleNext}
                        disabled={loading}
                        className="flex-1 h-14 rounded-2xl bg-green-400 text-black font-black text-lg hover:bg-green-300 transition-all disabled:opacity-50"
                      >
                        Continue
                      </button>
                    </div>
                  </div>
                )}

                {step === "address" && (
                  <div className="space-y-5">
                    <div>
                      <label className="text-sm text-zinc-400 font-medium">
                        Street Address
                      </label>
                      <input
                        type="text"
                        value={formData.address}
                        onChange={(e) => updateForm("address", e.target.value)}
                        placeholder="123 Main Street"
                        className="w-full mt-2 h-14 rounded-2xl bg-black/30 border border-white/10 px-5 outline-none focus:border-green-400 transition-all"
                      />
                    </div>

                    <div>
                      <label className="text-sm text-zinc-400 font-medium">
                        Apartment/Suite (Optional)
                      </label>
                      <input
                        type="text"
                        value={formData.apartment}
                        onChange={(e) =>
                          updateForm("apartment", e.target.value)
                        }
                        placeholder="Apt 4B"
                        className="w-full mt-2 h-14 rounded-2xl bg-black/30 border border-white/10 px-5 outline-none focus:border-green-400 transition-all"
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="text-sm text-zinc-400 font-medium">
                          City
                        </label>
                        <input
                          type="text"
                          value={formData.city}
                          onChange={(e) => updateForm("city", e.target.value)}
                          placeholder="New York"
                          className="w-full mt-2 h-14 rounded-2xl bg-black/30 border border-white/10 px-5 outline-none focus:border-green-400 transition-all"
                        />
                      </div>
                      <div>
                        <label className="text-sm text-zinc-400 font-medium">
                          State/Province
                        </label>
                        <input
                          type="text"
                          value={formData.state}
                          onChange={(e) => updateForm("state", e.target.value)}
                          placeholder="NY"
                          className="w-full mt-2 h-14 rounded-2xl bg-black/30 border border-white/10 px-5 outline-none focus:border-green-400 transition-all"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="text-sm text-zinc-400 font-medium">
                          Postal/ZIP Code
                        </label>
                        <input
                          type="text"
                          value={formData.postalCode}
                          onChange={(e) =>
                            updateForm("postalCode", e.target.value)
                          }
                          placeholder="10001"
                          className="w-full mt-2 h-14 rounded-2xl bg-black/30 border border-white/10 px-5 outline-none focus:border-green-400 transition-all"
                        />
                      </div>
                      <div>
                        <label className="text-sm text-zinc-400 font-medium">
                          Country
                        </label>
                        <select
                          value={formData.country}
                          onChange={(e) =>
                            updateForm("country", e.target.value)
                          }
                          className="w-full mt-2 h-14 rounded-2xl bg-black/30 border border-white/10 px-5 outline-none focus:border-green-400 transition-all text-zinc-400"
                        >
                          <option value="">Select country</option>
                          <option value="US">United States</option>
                          <option value="UK">United Kingdom</option>
                          <option value="CA">Canada</option>
                          <option value="NG">Nigeria</option>
                          <option value="AU">Australia</option>
                          <option value="DE">Germany</option>
                          <option value="FR">France</option>
                          <option value="other">Other</option>
                        </select>
                      </div>
                    </div>

                    {error && (
                      <div className="rounded-2xl border border-red-500/20 bg-red-500/10 p-4 text-sm text-red-300">
                        {error}
                      </div>
                    )}

                    <div className="flex gap-4">
                      <button
                        onClick={handlePrevious}
                        className="flex-1 h-14 rounded-2xl border border-white/10 bg-white/[0.05] font-black hover:bg-white/[0.08] transition-all"
                      >
                        Back
                      </button>
                      <button
                        onClick={handleNext}
                        disabled={loading}
                        className="flex-1 h-14 rounded-2xl bg-green-400 text-black font-black text-lg hover:bg-green-300 transition-all disabled:opacity-50"
                      >
                        Continue
                      </button>
                    </div>
                  </div>
                )}

                {step === "kyc" && (
                  <div className="space-y-5">
                    <div className="p-4 rounded-2xl border border-green-400/20 bg-green-400/5">
                      <div className="flex items-center gap-3">
                        <AppIcon name="shield" className="h-6 w-6 text-green-400" />
                        <div>
                          <p className="font-bold text-green-400">KYC Compliance</p>
                          <p className="text-sm text-zinc-500">
                            This information is required by banking regulations and is kept secure.
                          </p>
                        </div>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="text-sm text-zinc-400 font-medium">ID Type</label>
                        <select
                          value={formData.idType}
                          onChange={(e) => updateForm("idType", e.target.value)}
                          className="w-full mt-2 h-14 rounded-2xl bg-black/30 border border-white/10 px-5 outline-none focus:border-green-400 transition-all text-zinc-400"
                        >
                          <option value="">Select ID</option>
                          <option value="passport">Passport</option>
                          <option value="drivers_license">Driver&apos;s License</option>
                          <option value="national_id">National ID</option>
                          <option value="residence_permit">Residence Permit</option>
                        </select>
                      </div>
                      <div>
                        <label className="text-sm text-zinc-400 font-medium">ID Number</label>
                        <input
                          type="text"
                          value={formData.idNumber}
                          onChange={(e) => updateForm("idNumber", e.target.value)}
                          placeholder="A12345678"
                          className="w-full mt-2 h-14 rounded-2xl bg-black/30 border border-white/10 px-5 outline-none focus:border-green-400 transition-all"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="text-sm text-zinc-400 font-medium">ID Expiry Date</label>
                        <input
                          type="date"
                          value={formData.idExpiry}
                          onChange={(e) => updateForm("idExpiry", e.target.value)}
                          className="w-full mt-2 h-14 rounded-2xl bg-black/30 border border-white/10 px-5 outline-none focus:border-green-400 transition-all text-zinc-400"
                        />
                      </div>
                      <div>
                        <label className="text-sm text-zinc-400 font-medium">ID Issuing Country</label>
                        <select
                          value={formData.idIssuingCountry}
                          onChange={(e) => updateForm("idIssuingCountry", e.target.value)}
                          className="w-full mt-2 h-14 rounded-2xl bg-black/30 border border-white/10 px-5 outline-none focus:border-green-400 transition-all text-zinc-400"
                        >
                          <option value="">Select country</option>
                          <option value="US">United States</option>
                          <option value="UK">United Kingdom</option>
                          <option value="CA">Canada</option>
                          <option value="NG">Nigeria</option>
                          <option value="other">Other</option>
                        </select>
                      </div>
                    </div>

                    <div>
                      <label className="text-sm text-zinc-400 font-medium">Occupation</label>
                      <select
                        value={formData.occupation}
                        onChange={(e) => updateForm("occupation", e.target.value)}
                        className="w-full mt-2 h-14 rounded-2xl bg-black/30 border border-white/10 px-5 outline-none focus:border-green-400 transition-all text-zinc-400"
                      >
                        <option value="">Select occupation</option>
                        <option value="employed">Employed</option>
                        <option value="self_employed">Self-Employed</option>
                        <option value="student">Student</option>
                        <option value="retired">Retired</option>
                        <option value="unemployed">Unemployed</option>
                        <option value="business_owner">Business Owner</option>
                      </select>
                    </div>

                    <div>
                      <label className="text-sm text-zinc-400 font-medium">Employer (Optional)</label>
                      <input
                        type="text"
                        value={formData.employer}
                        onChange={(e) => updateForm("employer", e.target.value)}
                        placeholder="Company name"
                        className="w-full mt-2 h-14 rounded-2xl bg-black/30 border border-white/10 px-5 outline-none focus:border-green-400 transition-all"
                      />
                    </div>

                    <div>
                      <label className="text-sm text-zinc-400 font-medium">Annual Income</label>
                      <select
                        value={formData.annualIncome}
                        onChange={(e) => updateForm("annualIncome", e.target.value)}
                        className="w-full mt-2 h-14 rounded-2xl bg-black/30 border border-white/10 px-5 outline-none focus:border-green-400 transition-all text-zinc-400"
                      >
                        <option value="">Select income range</option>
                        <option value="0-25000">$0 - $25,000</option>
                        <option value="25000-50000">$25,000 - $50,000</option>
                        <option value="50000-100000">$50,000 - $100,000</option>
                        <option value="100000-250000">$100,000 - $250,000</option>
                        <option value="250000+">$250,000+</option>
                      </select>
                    </div>

                    <div>
                      <label className="text-sm text-zinc-400 font-medium">Source of Funds</label>
                      <select
                        value={formData.sourceOfFunds}
                        onChange={(e) => updateForm("sourceOfFunds", e.target.value)}
                        className="w-full mt-2 h-14 rounded-2xl bg-black/30 border border-white/10 px-5 outline-none focus:border-green-400 transition-all text-zinc-400"
                      >
                        <option value="">Select source</option>
                        <option value="salary">Salary/Employment</option>
                        <option value="business">Business Income</option>
                        <option value="investments">Investments</option>
                        <option value="savings">Savings</option>
                        <option value="inheritance">Inheritance</option>
                        <option value="other">Other</option>
                      </select>
                    </div>

                    <div className="space-y-3 pt-4">
                      <div className="flex items-start gap-3">
                        <input
                          type="checkbox"
                          checked={formData.agreeToTerms}
                          onChange={(e) => updateForm("agreeToTerms", e.target.checked)}
                          className="mt-1 h-5 w-5 rounded border-white/20 bg-black/30 text-green-400 focus:ring-green-400"
                        />
                        <label className="text-sm text-zinc-400">
                          I agree to the {" "}
                          <a href="#" className="text-green-400 hover:text-green-300">
                            Terms of Service
                          </a>{" "}
                          and {" "}
                          <a href="#" className="text-green-400 hover:text-green-300">
                            Account Agreement
                          </a>
                        </label>
                      </div>

                      <div className="flex items-start gap-3">
                        <input
                          type="checkbox"
                          checked={formData.agreeToPrivacy}
                          onChange={(e) =>
                            updateForm("agreeToPrivacy", e.target.checked)
                          }
                          className="mt-1 h-5 w-5 rounded border-white/20 bg-black/30 text-green-400 focus:ring-green-400"
                        />
                        <label className="text-sm text-zinc-400">
                          I agree to the {" "}
                          <a href="#" className="text-green-400 hover:text-green-300">
                            Privacy Policy
                          </a>{" "}
                          and consent to secure identity verification.
                        </label>
                      </div>

                      <div className="flex items-start gap-3">
                        <input
                          type="checkbox"
                          checked={formData.marketingOptIn}
                          onChange={(e) =>
                            updateForm("marketingOptIn", e.target.checked)
                          }
                          className="mt-1 h-5 w-5 rounded border-white/20 bg-black/30 text-green-400 focus:ring-green-400"
                        />
                        <label className="text-sm text-zinc-400">
                          Send me account updates and private banking product notices.
                        </label>
                      </div>
                    </div>

                    {error && (
                      <div className="rounded-2xl border border-red-500/20 bg-red-500/10 p-4 text-sm text-red-300">
                        {error}
                      </div>
                    )}

                    <div className="flex gap-4">
                      <button
                        onClick={handlePrevious}
                        className="flex-1 h-14 rounded-2xl border border-white/10 bg-white/[0.05] font-black hover:bg-white/[0.08] transition-all"
                      >
                        Back
                      </button>
                      <button
                        onClick={handleNext}
                        disabled={loading}
                        className="flex-1 h-14 rounded-2xl bg-green-400 text-black font-black text-lg hover:bg-green-300 transition-all disabled:opacity-50"
                      >
                        {loading ? "Creating..." : "Create Account"}
                      </button>
                    </div>

                    <button
                      onClick={handleSkipKyc}
                      disabled={loading}
                      className="w-full h-12 rounded-2xl border border-white/10 bg-white/[0.04] text-sm font-semibold text-zinc-300 hover:bg-white/[0.08] transition-all disabled:opacity-50"
                    >
                      Skip verification for now
                    </button>
                  </div>
                )}

                {step === "complete" && (
                  <div className="text-center">
                    <AurexBrand
                      className="justify-center"
                      markClassName="h-16 w-16 rounded-2xl"
                      titleClassName="text-2xl"
                      taglineClassName="text-xs"
                    />
                    <div className="mt-8 mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-green-400/20">
                      <AppIcon name="check" className="h-10 w-10 text-green-400" />
                    </div>
                    <h3 className="text-2xl font-black mt-6">Account Created!</h3>
                    <p className="text-zinc-500 mt-4">
                      We&apos;ve sent a verification link to <strong className="text-white">{formData.email}</strong>
                    </p>
                    <p className="text-zinc-500 mt-2 text-sm">
                      Please check your inbox and click the verification link to activate your Aurex Bank account.
                    </p>

                    {success && (
                      <div className="mt-6 rounded-2xl border border-green-500/20 bg-green-500/10 p-4 text-sm text-green-300">
                        {success}
                      </div>
                    )}

                    <button
                      onClick={() => router.push("/login")}
                      className="mt-8 w-full h-14 rounded-2xl bg-green-400 text-black font-black text-lg hover:bg-green-300 transition-all"
                    >
                      Go to Login
                    </button>
                  </div>
                )}
              </div>

              {/* LOGIN LINK */}
              {step !== "complete" && (
                <div className="mt-8 pt-6 border-t border-white/5 text-center">
                  <p className="text-zinc-500">Already have an account?</p>
                  <Link
                    href="/login"
                    className="mt-4 inline-block text-green-400 font-semibold hover:text-green-300 transition-all"
                  >
                    Sign In →
                  </Link>
                </div>
              )}
            </div>
          </div>
        </section>

        {/* RIGHT SIDE - Hero */}
        <section className="hidden lg:flex flex-col justify-between px-14 py-12 order-1 lg:order-2">
          <div>
            {/* LOGO */}
            <AurexBrand
              markClassName="h-16 w-16 rounded-2xl"
              titleClassName="text-4xl"
            />

            {/* HERO */}
            <div className="mt-20">
              <p className="text-green-400 text-xs uppercase tracking-[0.3em] font-semibold">
                Start Your Banking Journey
              </p>
              <h2 className="text-6xl font-black leading-[0.95] tracking-tight mt-6">
                Banking
                <br />
                Reimagined
                <br />
                For You
              </h2>
              <p className="text-zinc-400 text-lg leading-relaxed mt-8 max-w-xl">
                Join thousands of customers who trust Aurex Bank for secure digital banking, premium cards, real-time transfers, and crypto asset management.
              </p>
            </div>

            {/* FEATURES */}
            <div className="grid grid-cols-2 gap-4 mt-16">
              <div className="bg-white/[0.04] border border-white/10 rounded-lg p-6">
                <div className="w-12 h-12 rounded-2xl bg-green-400/20 flex items-center justify-center mb-4">
                  <AppIcon name="shield" className="h-6 w-6 text-green-400" />
                </div>
                <h3 className="text-xl font-black">Enterprise Security</h3>
                <p className="text-zinc-500 text-sm mt-2">Bank-level encryption and fraud protection</p>
              </div>
              <div className="bg-white/[0.04] border border-white/10 rounded-lg p-6">
                <div className="w-12 h-12 rounded-2xl bg-green-400/20 flex items-center justify-center mb-4">
                  <AppIcon name="card" className="h-6 w-6 text-green-400" />
                </div>
                <h3 className="text-xl font-black">Premium Cards</h3>
                <p className="text-zinc-500 text-sm mt-2">Virtual and physical cards with rewards</p>
              </div>
              <div className="bg-white/[0.04] border border-white/10 rounded-lg p-6">
                <div className="w-12 h-12 rounded-2xl bg-green-400/20 flex items-center justify-center mb-4">
                  <AppIcon name="send" className="h-6 w-6 text-green-400" />
                </div>
                <h3 className="text-xl font-black">Instant Transfers</h3>
                <p className="text-zinc-500 text-sm mt-2">Send money globally in seconds</p>
              </div>
              <div className="bg-white/[0.04] border border-white/10 rounded-lg p-6">
                <div className="w-12 h-12 rounded-2xl bg-green-400/20 flex items-center justify-center mb-4">
                  <AppIcon name="crypto" className="h-6 w-6 text-green-400" />
                </div>
                <h3 className="text-xl font-black">Crypto Ready</h3>
                <p className="text-zinc-500 text-sm mt-2">Buy, sell, and hold digital assets</p>
              </div>
            </div>
          </div>

          {/* FOOTER */}
          <div className="flex flex-wrap items-center gap-6 mt-10 text-sm text-zinc-500">
            <p>Protected by Aurex Secure</p>
            <div className="w-1 h-1 rounded-full bg-zinc-700" />
            <p>PCI DSS Compliant</p>
            <div className="w-1 h-1 rounded-full bg-zinc-700" />
            <p>End-to-End Encryption</p>
          </div>
        </section>
      </div>
    </main>
  );
}
