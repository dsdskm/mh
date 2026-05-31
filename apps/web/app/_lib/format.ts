const KRW = new Intl.NumberFormat("ko-KR");

export function formatCurrency(value: number): string {
  return `${KRW.format(value)}원`;
}

export function formatPhone(value: string): string {
  const digits = value.replace(/\D/g, "");

  if (digits.length === 11) {
    return `${digits.slice(0, 3)}-${digits.slice(3, 7)}-${digits.slice(7)}`;
  }

  if (digits.length === 10) {
    if (digits.startsWith("02")) {
      return `${digits.slice(0, 2)}-${digits.slice(2, 6)}-${digits.slice(6)}`;
    }

    return `${digits.slice(0, 3)}-${digits.slice(3, 6)}-${digits.slice(6)}`;
  }

  return value;
}

function pickYouTubeVideoId(url: URL): string | null {
  const host = url.hostname.replace(/^www\./, "").toLowerCase();

  if (host === "youtu.be") {
    const id = url.pathname.split("/").filter(Boolean)[0];
    return id ?? null;
  }

  if (host === "youtube.com" || host === "m.youtube.com" || host === "music.youtube.com") {
    if (url.pathname === "/watch") {
      return url.searchParams.get("v");
    }

    if (url.pathname.startsWith("/embed/")) {
      const id = url.pathname.split("/")[2];
      return id ?? null;
    }

    if (url.pathname.startsWith("/shorts/")) {
      const id = url.pathname.split("/")[2];
      return id ?? null;
    }
  }

  return null;
}

export function toEmbedVideoUrl(value: string): string {
  try {
    const hasProtocol = /^[a-zA-Z][a-zA-Z\d+\-.]*:/.test(value);
    const parsed = new URL(hasProtocol ? value : `https://${value}`);
    const videoId = pickYouTubeVideoId(parsed);

    if (!videoId) {
      return parsed.toString();
    }

    return `https://www.youtube-nocookie.com/embed/${videoId}`;
  } catch {
    return value;
  }
}