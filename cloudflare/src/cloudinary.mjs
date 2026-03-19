function requireCloudinary(env) {
  if (!env.CLOUDINARY_CLOUD_NAME || !env.CLOUDINARY_API_KEY || !env.CLOUDINARY_API_SECRET) {
    throw new Error("Missing Cloudinary configuration in Worker environment.");
  }
}

function buildBasicAuthHeader(env) {
  const credentials = `${env.CLOUDINARY_API_KEY}:${env.CLOUDINARY_API_SECRET}`;
  return `Basic ${btoa(credentials)}`;
}

function buildUploadUrl(cloudName) {
  return `https://api.cloudinary.com/v1_1/${cloudName}/image/upload`;
}

function buildResourcesUrl(cloudName, query = {}) {
  const url = new URL(`https://api.cloudinary.com/v1_1/${cloudName}/resources/image/upload`);

  for (const [key, value] of Object.entries(query)) {
    if (typeof value !== "undefined" && value !== null && value !== "") {
      url.searchParams.set(key, String(value));
    }
  }

  return url;
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

  const response = await fetch(buildUploadUrl(env.CLOUDINARY_CLOUD_NAME), {
    method: "POST",
    headers: {
      Authorization: buildBasicAuthHeader(env)
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

async function listCloudinaryImages(env) {
  requireCloudinary(env);

  const response = await fetch(buildResourcesUrl(env.CLOUDINARY_CLOUD_NAME, {
    max_results: 40,
    prefix: "badminton-scoreboard-live"
  }), {
    headers: {
      Authorization: buildBasicAuthHeader(env)
    }
  });

  const payload = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(payload.error?.message || "Could not load Cloudinary images.");
  }

  return {
    nextCursor: payload.next_cursor || null,
    resources: Array.isArray(payload.resources)
      ? payload.resources.map((resource) => ({
          assetId: resource.asset_id,
          bytes: resource.bytes,
          createdAt: resource.created_at,
          format: resource.format,
          height: resource.height,
          publicId: resource.public_id,
          secureUrl: resource.secure_url,
          thumbnailUrl: resource.secure_url,
          width: resource.width
        }))
      : []
  };
}

export { listCloudinaryImages, requireCloudinary, uploadImageToCloudinary };
