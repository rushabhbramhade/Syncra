import { NextRequest } from "next/server";
import { cookies } from "next/headers";
import { getCurrentUserAction } from "@/app/actions";
import { createServerClient } from "@insforge/sdk/ssr";

export async function POST(req: NextRequest) {
  try {
    // 1. Authenticate user
    const { data: userData, error: authError } = await getCurrentUserAction();
    if (authError || !userData?.user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { "Content-Type": "application/json" },
      });
    }

    // 2. Parse form data
    const formData = await req.formData();
    const file = formData.get("file") as File;
    if (!file) {
      return new Response(JSON.stringify({ error: "No file provided" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    // 3. Initialize InsForge Server Client using user's cookies
    const insforge = createServerClient({
      baseUrl: process.env.NEXT_PUBLIC_INSFORGE_BASE_URL,
      anonKey: process.env.NEXT_PUBLIC_INSFORGE_ANON_KEY,
      cookies: await cookies(),
      timeout: 10000,
    });

    // 4. Generate unique file key under the user's directory
    const cleanFileName = file.name.replace(/[^a-zA-Z0-9.-]/g, "_");
    const fileKey = `${userData.user.id}/${Date.now()}_${cleanFileName}`;

    // 5. Upload file to private "uploads" bucket
    const { data: uploadData, error: uploadError } = await insforge.storage
      .from("uploads")
      .upload(fileKey, file);

    if (uploadError) {
      console.error("Storage upload error:", uploadError);
      return new Response(JSON.stringify({ error: uploadError.message || "Upload to storage failed" }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      });
    }

    // 6. Generate secure signed URL for 7 days
    const { data: signedData, error: signedError } = await insforge.storage
      .from("uploads")
      .createSignedUrl(fileKey, 60 * 60 * 24 * 7);

    if (signedError || !signedData) {
      console.error("Signed URL creation error:", signedError);
      return new Response(JSON.stringify({ error: "Failed to generate file access URL" }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      });
    }

    return new Response(
      JSON.stringify({
        success: true,
        name: file.name,
        size: file.size,
        type: file.type,
        url: signedData.signedUrl,
        path: fileKey,
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }
    );
  } catch (error: any) {
    console.error("Upload API route error:", error);
    return new Response(JSON.stringify({ error: error.message || "Internal Server Error" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}
