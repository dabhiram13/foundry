import { useState, type ComponentProps } from 'react';
import { Autocomplete } from '@base-ui/react/autocomplete';
import { ChevronDown } from 'lucide-react';

// Base UI's free-form Autocomplete, composed for editable provider model IDs.
export function ModelInput({ value, onValueChange, models, ...props }: Omit<ComponentProps<'input'>, 'value' | 'onChange'> & {
  value: string;
  onValueChange: (value: string) => void;
  models: string[];
}) {
  const [open, setOpen] = useState(false);
  const [anchor, setAnchor] = useState<HTMLDivElement | null>(null);
  return <Autocomplete.Root items={models} value={value} onValueChange={onValueChange} open={open} onOpenChange={setOpen}>
    <div className="model-control" data-popup-open={open ? 'true' : undefined} ref={setAnchor} onKeyDown={event => {
      if (event.key === 'Enter') event.preventDefault();
      if (event.key === 'Escape' && open) {
        event.preventDefault();
        event.stopPropagation();
        setOpen(false);
      }
    }}>
      <Autocomplete.Input {...props} data-slot="input" className="model-input" placeholder="Use the default" autoComplete="off" />
      <Autocomplete.Trigger className="model-trigger" aria-label={`Show models for ${props['aria-label'] || 'Model'}`} tabIndex={-1}>
        <ChevronDown aria-hidden="true" />
      </Autocomplete.Trigger>
      <Autocomplete.Portal container={anchor?.closest('[role="dialog"]') as HTMLElement | undefined}>
        <Autocomplete.Positioner className="model-positioner" sideOffset={6}>
          <Autocomplete.Popup data-slot="model-popup" className="model-popup">
            <Autocomplete.Empty className="model-empty">No suggestions. You can use the model ID you typed.</Autocomplete.Empty>
            <Autocomplete.List>
              {(model: string) => <Autocomplete.Item key={model} value={model} className="model-option">{model}</Autocomplete.Item>}
            </Autocomplete.List>
          </Autocomplete.Popup>
        </Autocomplete.Positioner>
      </Autocomplete.Portal>
    </div>
  </Autocomplete.Root>;
}
