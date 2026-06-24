import type { FC } from 'hono/jsx'

interface HomeProps {
  name: string
  items: string[]
}

export const Home: FC<HomeProps> = ({ name, items }) => {
  return (
    <html lang="en">
      <head>
        <meta charset="utf-8" />
        <title>Hono + JSX</title>
      </head>
      <body>
        <h1>Hello, {name}!</h1>
        <p>Rendered with Hono JSX.</p>
        <ul>
          {items.map((item) => (
            <li>{item}</li>
          ))}
        </ul>
      </body>
    </html>
  )
}
