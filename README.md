# One-Click Conference Signup Tool

This project helps automate signing up for multiple conferences or events.

## Features

- Firebase Email/Password Authentication
- User profile management (name, email, phone, etc.)
- Event ingestion from Notion or by crawling HTML pages
- Automated form schema discovery using Puppeteer
- User-friendly mapping of profile fields to event form fields
- Automated signup via Cloud Tasks and Puppeteer
- CAPTCHA detection and manual resolution flagging
- Real-time signup progress updates

## Tech Stack

- **Frontend**: React (Create React App), Firebase SDK, Firestore, Material UI
- **Backend**: Node.js Cloud Functions (TypeScript), Puppeteer, Cloud Tasks, Firestore
- **Authentication**: Firebase Authentication
- **Database**: Firestore
- **Hosting**: Firebase Hosting (frontend), Firebase Functions (backend)

## Project Structure

```
├── firebase.json           # Firebase project configuration
├── .firebaserc             # Firebase project alias
├── firestore.rules         # Firestore security rules
├── firestore.indexes.json  # Firestore indexes (optional, can be auto-generated)
├── package.json            # Frontend dependencies and scripts
├── public/
│   └── index.html          # Main HTML file for React app
├── src/                    # React frontend source code
│   ├── App.js
│   ├── index.js
│   ├── firebase.js         # Firebase initialization
│   ├── components/         # Reusable React components
│   │   ├── Auth/           # Login, Signup components
│   │   ├── Profile/        # Profile form component
│   │   ├── Events/         # Event list, event item components
│   │   ├── Mapping/        # Field mapping UI component
│   │   └── Dashboard/      # Status dashboard component
│   ├── pages/              # Top-level page components
│   │   ├── LoginPage.js
│   │   ├── ProfilePage.js
│   │   ├── EventListPage.js
│   │   ├── MappingPage.js
│   │   └── DashboardPage.js
│   └── services/           # Services for interacting with Firebase (e.g., auth, firestore)
├── functions/              # Firebase Cloud Functions source code (TypeScript)
│   ├── src/
│   │   ├── index.ts        # Main entry point for Cloud Functions
│   │   ├── ingestEvents.ts # HTTP trigger for event ingestion
│   │   ├── discoverSchema.ts # Firestore trigger for schema discovery
│   │   ├── enqueueSignupTasks.ts # HTTP trigger to enqueue signups
│   │   └── processSignupTask.ts  # Cloud Task handler for form submission
│   ├── package.json        # Backend dependencies
│   ├── tsconfig.json       # TypeScript configuration for functions
└── README.md               # This file
```

## Environment Variables

Create a `.env` file in the `functions` directory (or configure directly in Firebase console):

```
NOTION_API_TOKEN=your_notion_api_token
# PUPPETEER_EXECUTABLE_PATH=/path/to/chrome # Optional: if not using puppeteer-core or bundled chromium
# PUPPETEER_LAUNCH_ARGS=--no-sandbox,--disable-setuid-sandbox # Example args, adjust as needed
```

**Important Puppeteer Notes for Cloud Functions:**

- By default, `puppeteer` downloads a full Chromium browser, which might exceed Cloud Function size limits.
- Consider using `puppeteer-core` and providing the `executablePath` to a pre-installed Chrome (e.g., in a custom Docker image if your Cloud Functions environment supports it, or use a lighter browser alternative if possible).
- For standard Node.js Cloud Functions environments, you might need to configure Puppeteer to use a bundled version of Chromium that works within the environment or explore alternatives like third-party services for heavy browser automation if Puppeteer proves too resource-intensive.
- Set appropriate launch arguments for Puppeteer, especially `--no-sandbox` and `--disable-setuid-sandbox` when running in a restricted environment like Cloud Functions. **Be aware of the security implications of these flags.**

## Setup

1.  **Clone the repository:**
    ```bash
    git clone <repository-url>
    cd one-click-conference-signup
    ```

2.  **Install Firebase CLI:**
    ```bash
    npm install -g firebase-tools
    ```

3.  **Login to Firebase:**
    ```bash
    firebase login
    ```

4.  **Configure Firebase Project:**
    -   Create a Firebase project in the [Firebase Console](https://console.firebase.google.com/).
    -   Copy your Project ID.
    -   Update the `default` project in `.firebaserc` with your Project ID:
        ```json
        {
          "projects": {
            "default": "YOUR_PROJECT_ID"
          }
        }
        ```
    -   In the Firebase Console, enable Email/Password authentication (Authentication > Sign-in method).
    -   Enable Firestore (Database > Create database).

5.  **Install Frontend Dependencies:**
    ```bash
    npm install
    # or
    # yarn install
    ```

6.  **Install Backend Dependencies:**
    ```bash
    cd functions
    npm install
    # or
    # yarn install
    cd ..
    ```

7.  **Set up Firebase Configuration in React App:**
    -   In the Firebase Console, go to Project Settings > General.
    -   Under "Your apps", click the Web icon (`</>`) to register a new web app.
    -   Copy the Firebase SDK configuration object.
    -   Create `src/firebase.js` and paste the config:
        ```javascript
        // src/firebase.js
        import { initializeApp } from 'firebase/app';
        import { getAuth } from 'firebase/auth';
        import { getFirestore } from 'firebase/firestore';
        import { getFunctions } from 'firebase/functions';

        const firebaseConfig = {
          apiKey: "YOUR_API_KEY",
          authDomain: "YOUR_AUTH_DOMAIN",
          projectId: "YOUR_PROJECT_ID",
          storageBucket: "YOUR_STORAGE_BUCKET",
          messagingSenderId: "YOUR_MESSAGING_SENDER_ID",
          appId: "YOUR_APP_ID"
        };

        // Initialize Firebase
        const app = initializeApp(firebaseConfig);
        const auth = getAuth(app);
        const db = getFirestore(app);
        const functions = getFunctions(app);
        // if you want to use the emulator, uncomment the following lines
        // import { connectAuthEmulator } from "firebase/auth";
        // import { connectFirestoreEmulator } from "firebase/firestore";
        // import { connectFunctionsEmulator } from "firebase/functions";
        // connectAuthEmulator(auth, "http://localhost:9099");
        // connectFirestoreEmulator(db, "http://localhost:8080");
        // connectFunctionsEmulator(functions, "http://localhost:5001");


        export { auth, db, functions, app };
        ```

8.  **Configure Environment Variables for Cloud Functions:**
    -   See the "Environment Variables" section above.
    -   Set these in the Firebase console (Functions > select your function > Configuration > Environment variables) or in `functions/.env` for local emulation.

## Development

1.  **Run Firebase Emulators (recommended):**
    ```bash
    firebase emulators:start
    ```
    This will start emulators for Authentication, Firestore, Functions, and Hosting.

2.  **Run React Development Server:**
    In a new terminal, from the project root:
    ```bash
    npm start
    ```
    This will open the React app, typically at `http://localhost:3000`.

## Deployment

1.  **Build the React App:**
    ```bash
    npm run build
    ```

2.  **Deploy to Firebase:**
    ```bash
    firebase deploy
    ```
    This command will deploy:
    -   Firestore rules (`firestore.rules`)
    -   Cloud Functions (from the `functions` directory)
    -   Frontend (from the `build` directory to Firebase Hosting)

## Cloud Functions Details

-   **`ingestEvents` (HTTP Trigger):**
    -   Endpoint: `/api/ingestEvents` (defined by `firebase.json` rewrite)
    -   Accepts a URL (e.g., Notion page).
    -   Fetches events using Notion API or Puppeteer HTML crawler.
    -   Normalizes and saves events to `/users/{uid}/events/{eventId}`.
    -   Triggers `discoverSchema` for each new event.

-   **`discoverSchema` (Firestore Trigger - onCreate):**
    -   Triggered when a new document is created in `/users/{uid}/events/{eventId}`.
    -   Uses Puppeteer to navigate to the event URL.
    -   Extracts form input fields (`<form>`, `<input>`, `<select>`, `<textarea>`).
    -   Saves the schema to `/users/{uid}/events/{eventId}/schema`.

-   **`enqueueSignupTasks` (HTTP Trigger):**
    -   Endpoint: `/api/enqueueSignupTasks`
    -   For the authenticated user, iterates through their events that have a mapping.
    -   Enqueues a Cloud Task for each event to be processed by `processSignupTask`.

-   **`processSignupTask` (Cloud Task Handler):**
    -   Receives event data (userId, eventId).
    -   Loads profile data, event schema, and field mapping from Firestore.
    -   Uses Puppeteer to navigate to the event URL, fill the form, and submit.
    -   Detects CAPTCHAs and updates status.
    -   Writes final status (success, needs-captcha, failed) to `/users/{uid}/events/{eventId}/status`.

## Security Considerations

-   Firestore rules are configured to restrict access to user-specific data.
-   Ensure that Notion API tokens and any other sensitive keys are stored securely as environment variables and not committed to the repository.
-   Be mindful of the resources consumed by Puppeteer in Cloud Functions. Optimize scripts and consider alternatives if costs or performance become an issue.
-   Regularly review and update dependencies for security patches.

This README provides a comprehensive guide to setting up, running, and deploying the application.