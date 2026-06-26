import { useEffect, useRef } from "react";
import { OpenSheetMusicDisplay } from "opensheetmusicdisplay";
import { buildMusicXML } from "../lib/musicxmlBuilder";
import type { Clef } from "../lib/notes";

interface FlashStaffProps {
  midi: number;
  clef: Clef;
  width?: number;
}

/**
 * Renders a single note on a real engraved staff (via OSMD) so the reading
 * trainer shows exactly the notation learners will meet in real pieces —
 * proper clef, ledger lines and accidentals included.
 */
export default function FlashStaff({ midi, clef, width = 280 }: FlashStaffProps) {
  const hostRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    host.innerHTML = "";
    const osmd = new OpenSheetMusicDisplay(host, {
      autoResize: false,
      drawTitle: false,
      drawSubtitle: false,
      drawComposer: false,
      drawCredits: false,
      drawPartNames: false,
      drawMeasureNumbers: false,
    });

    try {
      osmd.EngravingRules.RenderTimeSignatures = false;
      osmd.EngravingRules.RenderKeySignatures = false;
    } catch {
      /* older OSMD — ignore */
    }

    const xml = buildMusicXML([{ midi, beats: 4 }], {
      title: "",
      clef,
    });

    let disposed = false;
    osmd
      .load(xml)
      .then(() => {
        if (disposed) return;
        osmd.zoom = 1.0;
        osmd.render();
      })
      .catch((e) => console.error("flash render failed", e));

    return () => {
      disposed = true;
      try {
        osmd.clear();
      } catch {
        /* ignore */
      }
    };
  }, [midi, clef]);

  return <div ref={hostRef} style={{ width, minHeight: 150 }} />;
}
