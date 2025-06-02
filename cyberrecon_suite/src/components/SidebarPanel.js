import React from "react";
import "./SidebarPanel.css";

/**
 * PUBLIC_INTERFACE
 * Slide-in SidebarPanel component for contextual controls/history (Burp Suite-inspired).
 * Supports panel open/close, premium visual polish, and content slotting.
 *
 * Props:
 * - open: Boolean (whether the panel is open)
 * - onClose: Function (called when the close button is clicked)
 * - width: Number (optional, px width of sidebar panel, defaults 340)
 * - children: React nodes (panel contents)
 * - className: Additional class names
 * - ariaLabel: optional ARIA label for accessibility
 */
export default function SidebarPanel({
  open,
  onClose,
  width = 340,
  className = "",
  ariaLabel = "Slide-in sidebar panel",
  children,
}) {
  return (
    <>
      {/* Semi-transparent overlay for focus trapping & easy closing */}
      <div
        className={`sidebarpanel__overlay${open ? " sidebarpanel__overlay--show" : ""}`}
        onClick={onClose}
        tabIndex={-1}
        aria-hidden={!open}
        style={{ display: open ? "block" : "none" }}
      />
      <aside
        className={
          "sidebarpanel " +
          (open ? "sidebarpanel--open " : "sidebarpanel--closed ") +
          className
        }
        style={{
          right: open ? 0 : `-${width + 40}px`,
          width,
          boxShadow: open
            ? "-12px 0 34px 0 #000b, 0 1.5px 0 #150b0450"
            : "none",
          transition: "right 0.33s cubic-bezier(.41,1.20,.60,.98), box-shadow 0.21s",
        }}
        aria-label={ariaLabel}
        aria-modal={open ? "true" : undefined}
        role="complementary"
        tabIndex={open ? 0 : -1}
      >
        <button
          className="btn btn-ghost sidebarpanel__close-btn"
          onClick={onClose}
          aria-label="Close panel"
        >
          ←
        </button>
        <div className="sidebarpanel__content">{children}</div>
      </aside>
    </>
  );
}
