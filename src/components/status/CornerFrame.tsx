import type { ComponentProps } from 'react'

type CornerFrameProps = ComponentProps<'section'>

export function CornerFrame({ className = '', children, ...props }: CornerFrameProps) {
    return (
        <section {...props} className={`corner-frame ${className}`.trim()}>
            {children}
            <span className="hud-corner corner-top-left" aria-hidden="true" />
            <span className="hud-corner corner-top-right" aria-hidden="true" />
            <span className="hud-corner corner-bottom-left" aria-hidden="true" />
            <span className="hud-corner corner-bottom-right" aria-hidden="true" />
        </section>
    )
}