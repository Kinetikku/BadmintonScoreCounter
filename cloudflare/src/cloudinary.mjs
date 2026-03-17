function requireCloudinary(env) {
  if (!env.CLOUDINARY_CLOUD_NAME || !env.CLOUDINARY_API_KEY || !env.CLOUDINARY_API_SECRET) {
    throw new Error("Missing Cloudinary configuration in Worker environment.");
  }
}

function buildUploadUrl(cloudName) {
  return `https://api.cloudinary.com/v1_1/${cloudName}/image/upload`;
}

function sanitizeAssetKind(value) {
  const normalized = String(value || "asset").toLowerCase().replace(/[^a-z0-9-]+/g, "-");
  return normalized.replace(/^-+|-+$/g, "") || "asset";
}

async function uploadImageToCloudinary(request, env) {
  requireCloudinary(env);

  const incoming = await request.formData();
  const file = incoming.get("file");

  if (!(file instanceof File)) {
    throw new Error("Missing image file.");
  }

  const assetKind = sanitizeAssetKind(incoming.get("assetKind"));
  const uploadBody = new FormData();
  uploadBody.set("file", file, file.name || `${assetKind}.png`);
  uploadBody.set("folder", "badminton-scoreboard-live");
  uploadBody.set("public_id", `${assetKind}-${Date.now()}`);
  uploadBody.set("use_filename", "true");
  uploadBody.set("unique_filename", "true");

  const credentials = `${env.CLOUDINARY_API_KEY}:${env.CLOUDINARY_API_SECRET}`;
  const response = await fetch(buildUploadUrl(env.CLOUDINARY_CLOUD_NAME), {
    method: "POST",
    headers: {
      Authorization: `Basic ${btoa(credentials)}`
    },
    body: uploadBody
  });

  const payload = await response.json().catch(() => ({}));

  if (!response.ok || !payload.secure_url) {
    throw new Error(payload.error?.message || "Cloudinary upload failed.");
  }

  return {
    bytes: payload.bytes,
    format: payload.format,
    height: payload.height,
    publicId: payload.public_id,
    secureUrl: payload.secure_url,
    width: payload.width
  };
}

export { requireCloudinary, uploadImageToCloudinary };
