import { FileText, Image as ImageIcon, Video } from "lucide-react";

const MEDIA_ICONS = { IMAGE: ImageIcon, VIDEO: Video, DOCUMENT: FileText };

/** WhatsApp-style chat bubble for a rendered template preview. */
export function WhatsAppPreview({ preview, footnote }) {
  const MediaIcon = preview?.mediaFormat ? MEDIA_ICONS[preview.mediaFormat] : null;
  return (
    <div className="rounded-lg bg-[#efeae2] p-4">
      <div className="max-w-[92%] overflow-hidden rounded-lg rounded-tl-none bg-white text-sm shadow-sm">
        {MediaIcon ? (
          <div className="m-1 flex h-36 items-center justify-center rounded-md bg-[#d9dcd5] text-[#6b7268]">
            <MediaIcon className="size-8" />
          </div>
        ) : null}
        <div className="px-3 pb-2 pt-2">
          {preview?.header ? <p className="mb-1 font-semibold">{preview.header}</p> : null}
          <p className="whitespace-pre-wrap break-words leading-5">{preview?.body || <span className="text-[#999]">Your message appears here.</span>}</p>
          {preview?.footer ? <p className="mt-1.5 text-xs text-[#8a8a8a]">{preview.footer}</p> : null}
          <p className="mt-1 text-right text-[10px] text-[#9a9a9a]">12:00</p>
        </div>
        {preview?.buttons?.length ? (
          <div className="border-t border-[#eee]">
            {preview.buttons.map((text, index) => (
              <div key={`${text}-${index}`} className="border-b border-[#f1f1f1] py-2 text-center text-sm font-medium text-[#0a84c1] last:border-0">{text}</div>
            ))}
          </div>
        ) : null}
      </div>
      {footnote ? <p className="mt-3 text-xs text-[#6b6b6b]">{footnote}</p> : null}
    </div>
  );
}
