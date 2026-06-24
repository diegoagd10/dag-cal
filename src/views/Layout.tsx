import type { FC } from "hono/jsx";

interface LayoutProps {
	title: string;
	children?: unknown;
}

export const Layout: FC<LayoutProps> = ({ title, children }) => {
	return (
		<html lang="en">
			<head>
				<meta charset="utf-8" />
				<meta name="viewport" content="width=device-width, initial-scale=1" />
				<title>{title} — dag-cal</title>
			</head>
			<body>
				<nav>
					<a href="/">Home</a> | <a href="/foods">Foods</a>
				</nav>
				<main>{children}</main>
			</body>
		</html>
	);
};
