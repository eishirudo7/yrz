import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { CheckSquare } from "lucide-react";

interface MobileSelectProps {
  activeCategory: string;
  categories: { name: string; status: string; count?: number }[];
  onCategoryChange: (categoryName: string) => void;
}

export function MobileSelect({ activeCategory, categories, onCategoryChange }: MobileSelectProps) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline" className="w-full justify-between">
          {activeCategory || "Pilih Kategori"}
          <CheckSquare className="ml-2 h-4 w-4" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[200px] p-0">
        <div className="flex flex-col">
          {categories.map((category) => (
            <Button
              key={category.name}
              variant="ghost"
              className="justify-start"
              onClick={() => onCategoryChange(category.name)}
            >
              {category.name} {category.count ? `(${category.count})` : ''}
            </Button>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
} 