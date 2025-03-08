"use client"

import { useState } from "react"
import { Label } from "@/components/ui/label"
import { Slider } from "@/components/ui/slider"

interface TemperatureSliderProps {
  defaultValue: number
}

export function TemperatureSlider({ defaultValue = 0.4 }: TemperatureSliderProps) {
  const [value, setValue] = useState(defaultValue)

  return (
    <div className="grid gap-2">
      <Label htmlFor="openai_temperature">
        Temperature: {value}
      </Label>
      <div className="flex items-center gap-4">
        <Slider
          id="openai_temperature"
          name="openai_temperature"
          min={0}
          max={1}
          step={0.1}
          value={[value]}
          onValueChange={(vals) => setValue(vals[0])}
          className="w-[200px]"
        />
        
      </div>
    </div>
  )
}
