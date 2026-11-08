"use client"

import { useState, useEffect, useRef } from "react"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

interface UsernameInputProps {
  onUsernameSet: (username: string) => void
  isOpen: boolean
  onClose: () => void
  currentUsername: string | null
}

export function UsernameInput({ onUsernameSet, isOpen, onClose, currentUsername }: UsernameInputProps) {
  const [inputValue, setInputValue] = useState("")
  const hasLoadedFromStorage = useRef(false)

  // Load from localStorage ONLY on initial mount, not when editing
  useEffect(() => {
    if (hasLoadedFromStorage.current) return
    hasLoadedFromStorage.current = true
    
    const stored = localStorage.getItem("tictactoe_username")
    if (stored) {
      onUsernameSet(stored)
    }
  }, [onUsernameSet])

  // Set input value when editing existing username
  useEffect(() => {
    if (isOpen && currentUsername) {
      setInputValue(currentUsername)
    }
  }, [isOpen, currentUsername])

  const handleSubmit = () => {
    if (inputValue.trim().length < 2) return
    const name = inputValue.trim().slice(0, 20)
    localStorage.setItem("tictactoe_username", name)
    onUsernameSet(name)
    setInputValue("")
  }

  if (!isOpen) {
    return null
  }

  const isEditing = !!currentUsername

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Blurred backdrop */}
      <div className="absolute inset-0 bg-background/80 backdrop-blur-sm" />
      
      {/* Modal card */}
      <Card className="relative z-10 w-full max-w-sm shadow-lg">
        <CardHeader className="pb-2">
          <CardTitle className="text-lg text-center">
            {isEditing ? "Namen ändern" : "Wie heißt du?"}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col gap-3">
            <Input
              placeholder="Dein Name"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              maxLength={20}
              onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
              autoFocus
              className="text-center text-lg"
            />
            <div className="flex gap-2">
              {isEditing && (
                <Button 
                  variant="outline" 
                  onClick={onClose}
                  className="flex-1"
                >
                  Abbrechen
                </Button>
              )}
              <Button 
                onClick={handleSubmit} 
                disabled={inputValue.trim().length < 2}
                className="flex-1"
              >
                {isEditing ? "Speichern" : "Los geht's"}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
