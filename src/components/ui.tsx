"use client";
import Link from "next/link";
import { useEffect, useRef, type ReactNode } from "react";
import { ArrowUpRight, X, Sprout, Search, AlertCircle } from "lucide-react";
import { motion } from "motion/react";
import type { Profile } from "@/lib/model";
export function Brand({ name = "SkillSpring" }: { name?: string }) {
  return (
    <Link className="brand" href="/" aria-label={`${name} home`}>
      <span className="brand-mark">
        <Sprout size={23} />
      </span>
      {name}
      <span className="brand-dot">.</span>
    </Link>
  );
}
// Content is visible in the server HTML even if animation JS never loads.
export function Reveal({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <motion.div
      className={className}
      initial={{ opacity: 1, y: 12 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.08 }}
      transition={{ duration: 0.35, ease: "easeOut" }}
    >
      {children}
    </motion.div>
  );
}
export function Avatar({
  person,
  size = "",
}: {
  person: Pick<Profile, "name" | "photo">;
  size?: string;
}) {
  const initials = person.name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((s) => s[0])
    .join("");
  return person.photo ? (
    <img
      className={`avatar ${size}`}
      src={person.photo}
      alt={person.name}
      width={64}
      height={64}
      loading="lazy"
    />
  ) : (
    <span className={`avatar ${size}`} aria-label={person.name}>
      {initials || "S"}
    </span>
  );
}
export function Empty({
  title = "A new beginning",
  text,
  href,
  label = "Explore skills",
}: {
  title?: string;
  text: string;
  href?: string;
  label?: string;
}) {
  return (
    <div className="empty">
      <span className="empty-icon">
        <Sprout size={32} />
      </span>
      <h3>{title}</h3>
      <p>{text}</p>
      {href && (
        <Link className="button" href={href}>
          {label}
          <ArrowUpRight size={16} />
        </Link>
      )}
    </div>
  );
}
export function ErrorBox({
  message,
  retry,
}: {
  message: string;
  retry?: () => void;
}) {
  if (!message) return null;
  return (
    <div className="error" role="alert">
      <AlertCircle size={18} />
      <span>{message}</span>
      {retry && (
        <button className="text-button" onClick={retry}>
          Retry
        </button>
      )}
    </div>
  );
}
export function Skeleton() {
  return (
    <div className="skeleton-grid" role="status" aria-label="Loading">
      <div />
      <div />
      <div />
    </div>
  );
}
export function Modal({
  title,
  children,
  onClose,
}: {
  title: string;
  children: ReactNode;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const d = ref.current;
    d?.showModal();
    return () => d?.close();
  }, []);
  return (
    <dialog
      className="modal"
      ref={ref}
      onCancel={onClose}
      aria-labelledby="dialog-title"
    >
      <header>
        <h2 id="dialog-title">{title}</h2>
        <button
          className="icon-button"
          aria-label="Close dialog"
          onClick={onClose}
        >
          <X />
        </button>
      </header>
      {children}
    </dialog>
  );
}
export function Tag({
  children,
  tone = "",
}: {
  children: ReactNode;
  tone?: string;
}) {
  return <span className={`tag ${tone}`}>{children}</span>;
}
export function PageTitle({
  eyebrow,
  title,
  text,
  action,
}: {
  eyebrow?: string;
  title: string;
  text?: string;
  action?: ReactNode;
}) {
  return (
    <div className="page-title">
      <div>
        {eyebrow && <p className="eyebrow">{eyebrow}</p>}
        <h1>{title}</h1>
        {text && <p>{text}</p>}
      </div>
      {action}
    </div>
  );
}
export function SearchIcon() {
  return <Search size={18} />;
}
export function dateTime(n: number, zone?: string) {
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: zone || undefined,
  }).format(n);
}
