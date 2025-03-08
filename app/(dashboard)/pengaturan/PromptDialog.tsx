'use client'

import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Expand } from "lucide-react"

interface PromptDialogProps {
  defaultValue: string
}

export function PromptDialog({ defaultValue }: PromptDialogProps) {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="ghost" size="icon" className="h-8 w-8">
          <Expand className="h-4 w-4" />
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-[90vw] h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Edit Prompt</DialogTitle>
        </DialogHeader>
        <div className="flex-1 min-h-0">
          <Textarea 
            id="openai_prompt_fullscreen" 
            defaultValue={defaultValue}
            className="h-full w-full resize-none"
            onChange={(e) => {
              const mainTextarea = document.getElementById('openai_prompt') as HTMLTextAreaElement;
              if (mainTextarea) mainTextarea.value = e.target.value;
            }}
          />
        </div>
      </DialogContent>
    </Dialog>
  )
}
