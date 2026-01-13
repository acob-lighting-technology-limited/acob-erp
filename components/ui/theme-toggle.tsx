"use client"

import { useState, useRef, useEffect } from "react"
import { Moon, Sun, Monitor } from "lucide-react"
import { useTheme } from "next-themes"
import { Button } from "@/components/ui/button"
import { motion, AnimatePresence } from "framer-motion"

interface ThemeToggleProps {
  direction?: "up" | "down"
}

export function ThemeToggle({ direction = "down" }: ThemeToggleProps) {
  const { setTheme, theme } = useTheme()
  const [isOpen, setIsOpen] = useState(false)
  const [mounted, setMounted] = useState(false)
  const [dropdownPosition, setDropdownPosition] = useState({ top: 0, right: 0 })
  const dropdownRef = useRef<HTMLDivElement>(null)
  const buttonRef = useRef<HTMLButtonElement>(null)

  // Ensure component is mounted before showing to prevent hydration mismatch
  useEffect(() => {
    setMounted(true)
  }, [])

  // Calculate dropdown position when opening
  useEffect(() => {
    if (isOpen && buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect()
      setDropdownPosition({
        top: rect.bottom + 8,
        right: window.innerWidth - rect.right,
      })
    }
  }, [isOpen])

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: Event) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node) &&
        buttonRef.current &&
        !buttonRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false)
      }
    }

    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside)
    }

    return () => {
      document.removeEventListener("mousedown", handleClickOutside)
    }
  }, [isOpen])

  const themes = [
    {
      name: "Light",
      value: "light",
      icon: Sun,
    },
    {
      name: "Dark",
      value: "dark",
      icon: Moon,
    },
    {
      name: "System",
      value: "system",
      icon: Monitor,
    },
  ]

  const handleThemeChange = (newTheme: string) => {
    setTheme(newTheme)
    setIsOpen(false)
  }

  // Don't render anything until mounted to avoid hydration mismatch
  if (!mounted) {
    return (
      <Button variant="ghost" size="icon" className="group relative overflow-hidden">
        <div className="relative z-10 flex h-full w-full items-center justify-center">
          <Sun className="h-[1.2rem] w-[1.2rem]" />
        </div>
      </Button>
    )
  }

  return (
    <>
      <Button
        ref={buttonRef}
        variant="ghost"
        size="icon"
        data-theme-toggle
        onClick={() => setIsOpen(!isOpen)}
        className="group relative overflow-hidden"
      >
        {/* Animated fill effect - fills entire button */}
        <div className="bg-primary absolute inset-0 origin-center scale-0 transform rounded-md transition-transform duration-500 ease-out group-hover:scale-[1.02]" />
        {/* Icon container */}
        <div className="relative z-10 flex h-full w-full items-center justify-center transition-all duration-500 group-hover:scale-110">
          <Sun className="h-[1.2rem] w-[1.2rem] scale-100 rotate-0 transition-all group-hover:text-white! dark:scale-0 dark:-rotate-90" />
          <Moon className="absolute h-[1.2rem] w-[1.2rem] scale-0 rotate-90 transition-all group-hover:text-white! dark:scale-100 dark:rotate-0" />
        </div>
        <span className="sr-only">Toggle theme</span>
      </Button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            ref={dropdownRef}
            initial={{
              opacity: 0,
              y: direction === "up" ? 10 : -10,
              scale: 0.95,
            }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: direction === "up" ? 10 : -10, scale: 0.95 }}
            transition={{ duration: 0.2, ease: "easeOut" }}
            className="bg-popover border-border fixed z-[9999] w-40 overflow-hidden rounded-lg border shadow-2xl"
            style={{
              top: dropdownPosition.top,
              right: dropdownPosition.right,
            }}
          >
            <div className="p-2">
              {themes.map(({ name, value, icon: Icon }, index) => (
                <motion.div
                  key={value}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.05, duration: 0.2 }}
                >
                  <button
                    onClick={() => handleThemeChange(value)}
                    className={`group flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm transition-all duration-500 ${
                      theme === value
                        ? "bg-primary/10 text-primary font-medium"
                        : "text-foreground hover:bg-muted transform hover:scale-105 hover:shadow-md"
                    }`}
                  >
                    <div
                      className={`relative flex h-8 w-8 items-center justify-center overflow-hidden rounded-full p-1.5 transition-all duration-500 ${
                        theme === value ? "bg-primary" : "bg-primary/10 group-hover:bg-primary group-hover:scale-110"
                      }`}
                    >
                      {theme !== value && (
                        <div className="bg-primary absolute inset-0 origin-center scale-0 transform rounded-full transition-transform duration-500 ease-out group-hover:scale-100" />
                      )}
                      <Icon
                        className={`relative z-10 h-4 w-4 transition-colors duration-500 ${
                          theme === value
                            ? "text-primary-foreground"
                            : "text-muted-foreground group-hover:text-primary-foreground"
                        }`}
                      />
                    </div>
                    <span>{name}</span>
                    {theme === value && (
                      <motion.div
                        layoutId="activeTheme"
                        className="bg-primary ml-auto h-1.5 w-1.5 rounded-full"
                        transition={{
                          type: "spring",
                          stiffness: 300,
                          damping: 30,
                        }}
                      />
                    )}
                  </button>
                </motion.div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  )
}
