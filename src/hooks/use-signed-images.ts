import { useEffect, useState } from "react";
import { resolveImageUrls } from "@/lib/pet-images";

export function useSignedImages(paths: (string | null | undefined)[]) {
  const clean = paths.filter((p): p is string => !!p);
  const key = clean.join("|");
  const [urls, setUrls] = useState<Record<string, string>>({});

  useEffect(() => {
    let active = true;
    if (!clean.length) {
      setUrls({});
      return;
    }
    void resolveImageUrls(clean).then((res) => {
      if (active) setUrls(res);
    });
    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  return urls;
}
