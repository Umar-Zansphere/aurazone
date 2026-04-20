import { jwtVerify } from "jose";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";

const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";
const DEFAULT_MODEL = "openai/gpt-4o-mini";

const extractJsonObject = (text) => {
  const trimmed = String(text || "").trim();
  if (!trimmed) {
    throw new Error("OpenRouter returned an empty response.");
  }

  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = fenced?.[1] || trimmed;

  try {
    return JSON.parse(candidate);
  } catch (_) {
    const firstBrace = candidate.indexOf("{");
    const lastBrace = candidate.lastIndexOf("}");
    if (firstBrace === -1 || lastBrace === -1 || lastBrace <= firstBrace) {
      throw new Error("OpenRouter did not return valid JSON.");
    }
    return JSON.parse(candidate.slice(firstBrace, lastBrace + 1));
  }
};

const normalizeTag = (tag) =>
  String(tag || "")
    .trim()
    .toLowerCase()
    .replace(/#/g, "")
    .replace(/[^a-z0-9 -]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-");

const unique = (items) => Array.from(new Set(items.filter(Boolean)));

const fallbackTags = ({ category, gender, presetLabel, name }) => {
  const base = [
    category,
    gender,
    presetLabel,
    ...(String(name || "")
      .split(/\s+/)
      .slice(0, 2)
      .map((word) => word.toLowerCase())),
  ]
    .map(normalizeTag)
    .filter(Boolean);

  return unique(base).slice(0, 8);
};

const ensureDescription = (value) => String(value || "").trim().slice(0, 420);
const ensureShortDescription = (value) => String(value || "").trim().slice(0, 140);

const getSecret = () => {
  const secret = process.env.JWT_SECRET;
  return secret ? new TextEncoder().encode(secret) : null;
};

const verifyAdmin = async () => {
  const secret = getSecret();
  const token = (await cookies()).get("accessToken")?.value;

  if (!secret || !token) {
    return null;
  }

  try {
    const result = await jwtVerify(token, secret);
    return result.payload?.role === "ADMIN" ? result.payload : null;
  } catch (_) {
    return null;
  }
};

export async function POST(request) {
  const auth = await verifyAdmin();
  if (!auth) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { message: "OPENROUTER_API_KEY is missing in the admin environment." },
      { status: 500 }
    );
  }

  const body = await request.json();
  const {
    name,
    brand,
    modelNumber,
    category,
    gender,
    tags,
    description,
    shortDescription,
    presetLabel,
    colors,
    sizes,
    target = "all",
  } = body || {};

  if (!name || !brand) {
    return NextResponse.json(
      { message: "Product name and brand are required to generate product content." },
      { status: 400 }
    );
  }

  const requestedFields =
    target === "tags"
      ? ["tags"]
      : target === "copy"
        ? ["shortDescription", "description"]
        : ["tags", "shortDescription", "description"];

  const prompt = {
    product: {
      name,
      brand,
      modelNumber: modelNumber || "",
      category: category || "",
      gender: gender || "",
      presetLabel: presetLabel || "",
      colors: Array.isArray(colors) ? colors : [],
      sizes: Array.isArray(sizes) ? sizes : [],
      currentTags: tags || "",
      currentShortDescription: shortDescription || "",
      currentDescription: description || "",
    },
    requestedFields,
    rules: {
      tags: "Return 4 to 8 concise ecommerce tags as lowercase strings with no hash symbols.",
      shortDescription: "Return one punchy sentence under 140 characters.",
      description: "Return 2 or 3 sentences of clean product copy with no markdown.",
    },
  };

  const response = await fetch(OPENROUTER_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      "HTTP-Referer": process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000",
      "X-Title": "AuraZone Admin",
    },
    body: JSON.stringify({
      model: process.env.OPENROUTER_MODEL || DEFAULT_MODEL,
      messages: [
        {
          role: "system",
          content:
            "You write ecommerce product content for a footwear admin tool. Respond with valid JSON only and no extra text.",
        },
        {
          role: "user",
          content: JSON.stringify(prompt),
        },
      ],
      temperature: 0.5,
    }),
  });

  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    return NextResponse.json(
      { message: payload?.error?.message || payload?.message || "OpenRouter request failed." },
      { status: response.status }
    );
  }

  try {
    const content = payload?.choices?.[0]?.message?.content;
    const parsed = extractJsonObject(
      Array.isArray(content) ? content.map((part) => part?.text || "").join("") : content
    );

    const generatedTags = unique(
      (Array.isArray(parsed.tags) ? parsed.tags : String(parsed.tags || "").split(","))
        .map(normalizeTag)
        .filter(Boolean)
    ).slice(0, 8);

    const result = {
      tags: generatedTags.length > 0 ? generatedTags : fallbackTags({ category, gender, presetLabel, name }),
      shortDescription: ensureShortDescription(parsed.shortDescription),
      description: ensureDescription(parsed.description),
    };

    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      { message: error.message || "Failed to parse OpenRouter response." },
      { status: 500 }
    );
  }
}
