import { useId, useRef, useState, type DragEvent, type ReactNode } from "react";
import { UploadCloudIcon, FileIcon, TrashIcon, ErrorIcon } from "../icons";
import "./field.css";
import "./Dropzone.css";

export interface DropzoneProps {
  onFilesSelected: (files: File[]) => void;
  /** Native `accept` attribute, e.g. "image/*,.pdf". Also checked on drag-and-drop, which the
   *  browser doesn't filter: a dropped file that doesn't match is set aside with a message. */
  accept?: string;
  multiple?: boolean;
  /** Files heavier than this are set aside with a message instead of being passed on. */
  maxSizeMB?: number;
  disabled?: boolean;
  label?: string;
  hint?: string;
  /** Texte principal de la zone. Défaut « Cliquez ou glissez un fichier ». */
  dropLabel?: ReactNode;
  /** Texte de la zone pendant qu'un fichier la survole. Défaut « Déposez pour importer ». */
  dragActiveLabel?: ReactNode;
  /** Message affiché sous la zone pour les fichiers écartés (trop lourds, d'un type refusé). Par
   *  défaut une phrase en français qui les nomme. Un `error` passé par l'appelant passe devant. */
  formatRejection?: (rejected: { file: File; reason: "size" | "type" }[]) => ReactNode;
  /** Appelé avec les fichiers écartés, en plus du message. */
  onFilesRejected?: (rejected: { file: File; reason: "size" | "type" }[]) => void;
  error?: string;
  /** Currently selected files, rendered as a removable list below the drop area. Fully controlled by the caller. */
  files?: File[];
  onRemoveFile?: (index: number) => void;
  className?: string;
}

const MB = 1024 * 1024;

/** Tailles à la française : « 1,2 Mo », « 340 Ko ». */
function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} o`;
  if (bytes < MB) return `${Math.round(bytes / 1024).toLocaleString("fr-FR")} Ko`;
  return `${(bytes / MB).toLocaleString("fr-FR", { minimumFractionDigits: 1, maximumFractionDigits: 1 })} Mo`;
}

/** Le contrôle de l'attribut `accept` que le navigateur ne fait qu'au sélecteur de fichiers :
 *  extensions (`.pdf`), familles (`image/*`) et types exacts (`application/pdf`). */
function matchesAccept(file: File, accept: string | undefined): boolean {
  if (!accept) return true;
  const name = file.name.toLowerCase();
  const type = file.type.toLowerCase();
  return accept
    .split(",")
    .map((t) => t.trim().toLowerCase())
    .filter(Boolean)
    .some((token) => {
      if (token.startsWith(".")) return name.endsWith(token);
      if (token.endsWith("/*")) return type.startsWith(token.slice(0, -1));
      return type === token;
    });
}

function defaultRejection(rejected: { file: File; reason: "size" | "type" }[], maxSizeMB: number | undefined): string {
  const names = (reason: "size" | "type") =>
    rejected
      .filter((r) => r.reason === reason)
      .map((r) => `« ${r.file.name} »`)
      .join(", ");
  const parts: string[] = [];
  const tooBig = names("size");
  const wrongType = names("type");
  if (tooBig) parts.push(`Trop lourd (plus de ${(maxSizeMB ?? 0).toLocaleString("fr-FR")} Mo) : ${tooBig}.`);
  if (wrongType) parts.push(`Type de fichier non accepté : ${wrongType}.`);
  return parts.join(" ");
}

/** Drag-and-drop file upload zone with click-to-browse fallback and an optional selected-files list. */
export function Dropzone({
  onFilesSelected,
  accept,
  multiple = true,
  maxSizeMB,
  disabled,
  label = "Glissez-déposez vos fichiers ici",
  hint,
  dropLabel = "Cliquez ou glissez un fichier",
  dragActiveLabel = "Déposez pour importer",
  formatRejection,
  onFilesRejected,
  error,
  files,
  onRemoveFile,
  className,
}: DropzoneProps) {
  const [isDragging, setIsDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const inputId = useId();
  const [rejection, setRejection] = useState<ReactNode>(null);

  function acceptFiles(list: FileList | null) {
    if (!list) return;
    const rejected: { file: File; reason: "size" | "type" }[] = [];
    let picked = Array.from(list).filter((file) => {
      if (!matchesAccept(file, accept)) rejected.push({ file, reason: "type" });
      else if (maxSizeMB && file.size > maxSizeMB * MB) rejected.push({ file, reason: "size" });
      else return true;
      return false;
    });
    if (!multiple) picked = picked.slice(0, 1);
    setRejection(rejected.length > 0 ? (formatRejection ?? ((r) => defaultRejection(r, maxSizeMB)))(rejected) : null);
    if (rejected.length > 0) onFilesRejected?.(rejected);
    if (picked.length > 0) onFilesSelected(picked);
  }

  function handleDrop(e: DragEvent<HTMLDivElement>) {
    e.preventDefault();
    setIsDragging(false);
    if (disabled) return;
    acceptFiles(e.dataTransfer.files);
  }

  return (
    <div className={["lq-field", className].filter(Boolean).join(" ")}>
      {label && (
        <label htmlFor={inputId} className="lq-field__label">
          {label}
        </label>
      )}
      <div
        className={[
          "lq-dropzone",
          isDragging && "lq-dropzone--dragging",
          error && "lq-dropzone--error",
          disabled && "lq-dropzone--disabled",
        ]
          .filter(Boolean)
          .join(" ")}
        onDragOver={(e) => {
          e.preventDefault();
          if (!disabled) setIsDragging(true);
        }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={handleDrop}
        onClick={() => !disabled && inputRef.current?.click()}
        role="button"
        tabIndex={disabled ? -1 : 0}
        onKeyDown={(e) => {
          if (!disabled && (e.key === "Enter" || e.key === " ")) {
            e.preventDefault();
            inputRef.current?.click();
          }
        }}
      >
        <UploadCloudIcon size={28} className="lq-dropzone__icon" />
        <span className="lq-dropzone__label">{isDragging ? dragActiveLabel : dropLabel}</span>
        {hint && <span className="lq-dropzone__hint">{hint}</span>}
        <input
          ref={inputRef}
          id={inputId}
          type="file"
          className="lq-dropzone__input"
          accept={accept}
          multiple={multiple}
          disabled={disabled}
          onChange={(e) => {
            acceptFiles(e.target.files);
            // Vidé à chaque fois : sinon re-choisir le même fichier (après l'avoir retiré de la
            // liste) ne déclenche aucun `change`.
            e.target.value = "";
          }}
        />
      </div>

      {(error || rejection) && (
        <span className="lq-field__error" role="alert">
          <ErrorIcon size={14} />
          {error || rejection}
        </span>
      )}

      {files && files.length > 0 && (
        <ul className="lq-dropzone__files">
          {files.map((file, i) => (
            <li key={`${file.name}-${i}`} className="lq-dropzone__file">
              <FileIcon size={16} />
              <span className="lq-dropzone__file-name">{file.name}</span>
              <span className="lq-dropzone__file-size">{formatBytes(file.size)}</span>
              {onRemoveFile && (
                <button type="button" className="lq-field__icon-button" onClick={() => onRemoveFile(i)} aria-label={`Retirer ${file.name}`}>
                  <TrashIcon size={15} />
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
