# EPIC-02 — PROFESSIONAL PROFILE
## Feature F01 — Profile Identity

> **Status:** UX / Product Specification  
> **Epic:** EPIC-02 — Professional Profile  
> **Feature:** F01 — Profile Identity

## 1. Feature Overview

Profile Identity establishes the user's core professional identity.

It includes:
- Name
- Profile photo
- Professional headline
- Location
- Professional contact information
- Professional links, where supported

The identity layer is used throughout the Professional Profile and public-facing profile representation.

### UX Goal
> **Who am I professionally?**

The experience should feel like building a professional identity, not filling out an administrative form.

## 2. Feature Objective

The feature enables users to:
1. Establish their professional identity.
2. Present their name clearly.
3. Communicate what they do through a concise headline.
4. Provide relevant professional context such as location.
5. Add appropriate professional contact information.
6. Upload and manage a professional profile image.
7. Preview how their identity appears to others.
8. Edit information without losing existing profile data.

## 3. Business Rules

### BR-01 — Identity ownership
Each professional profile must belong to exactly one authenticated user.

### BR-02 — Name
The user's name is the primary identity displayed throughout the profile. The name is required.

### BR-03 — Professional headline
The professional headline communicates the user's primary professional positioning and should be concise enough for profile headers, cards, previews, and public profile pages.

### BR-04 — Profile photo
A profile photo is optional unless a future business rule makes it mandatory. Profiles without a photo must remain visually complete.

### BR-05 — Location
Location provides professional context. The profile should preferably represent a professional location such as Bhopal, India, rather than a precise residential address.

### BR-06 — Contact information
Only information explicitly intended for professional visibility should be exposed through the public profile. Private authentication/account information must not automatically become public.

### BR-07 — Editing
Users can modify their identity information after initial creation.

### BR-08 — Persistence
Valid changes must be persisted without requiring the user to recreate the profile.

### BR-09 — Save feedback
The UI must clearly communicate whether changes are saving, saved, or failed.

### BR-10 — Data preservation
A failed save must not cause entered information to disappear.

### BR-11 — Preview consistency
The profile preview must represent the identity information according to the application's save model.

### BR-12 — Professional representation
The identity layer should be optimized for professional presentation rather than administrative completeness.

## 4. Business Scenarios

### BS-01 — First-time profile creation
**Given** a user has authenticated but has not created their professional profile.
**When** the user opens Professional Profile.
**Then** the system presents a guided identity setup experience focused on the minimum essential information first.

### BS-02 — Returning user
**Given** a user already has a profile.
**When** they open Professional Profile.
**Then** existing identity information is immediately visible and onboarding is not repeated.

### BS-03 — User updates headline
**Given** a profile already exists.
**When** the user changes their professional headline.
**Then** the value is validated, saved, communicated as saved, and reflected in preview.

### BS-04 — User has no photo
**Given** the user has no profile photo.
**When** the profile is displayed.
**Then** a designed fallback avatar is displayed.

### BS-05 — User removes photo
**Given** a profile contains a photo.
**When** the user removes it.
**Then** the system returns to the default avatar state.

### BS-06 — Invalid information
**Given** the user enters invalid information.
**When** validation occurs.
**Then** the relevant field clearly communicates what is wrong and how to fix it without clearing the user's input.

### BS-07 — Save failure
**Given** the user edits their identity.
**When** the server cannot save the change.
**Then** the user's input remains available and a retry mechanism is provided.

## 5. Functional Requirements

- **FR-01:** Display profile photo/avatar, full name, professional headline, and location in the primary profile header.
- **FR-02:** Allow the user to create and edit their professional name.
- **FR-03:** Allow the user to create and edit their professional headline.
- **FR-04:** Allow upload, replacement, and removal of a profile photo.
- **FR-05:** Allow the user to provide and edit professional location.
- **FR-06:** Allow management of supported professional contact information.
- **FR-07:** Persist valid changes.
- **FR-08:** Communicate Saving, Saved, and Couldn't save states.
- **FR-09:** Provide profile preview.
- **FR-10:** Support desktop, tablet, and mobile.

## 6. Fields & Validation

### First Name
| Property | Specification |
|---|---|
| Required | Yes |
| Type | Text |
| Minimum | 1 character |
| Maximum | 50 characters |
| Whitespace | Trim leading/trailing whitespace |
| Validation | Cannot be empty |

### Last Name
| Property | Specification |
|---|---|
| Required | Yes |
| Type | Text |
| Minimum | 1 character |
| Maximum | 50 characters |
| Whitespace | Trim leading/trailing whitespace |

### Professional Headline
| Property | Specification |
|---|---|
| Required | Recommended / configurable |
| Type | Text |
| Maximum | 80 characters |
| Multiline | No |
| Counter | Yes |

Guidance: Describe what you do professionally in one short line.

### Profile Photo
| Property | Specification |
|---|---|
| Required | No |
| Type | Image |
| Supported formats | JPG, JPEG, PNG, WebP |
| Maximum file size | Product-configurable |
| Recommended ratio | 1:1 |

The image should be cropped to a consistent profile-avatar ratio.

### Location
| Property | Specification |
|---|---|
| Required | No |
| Type | Text / structured location |
| Recommended format | City, Country |
| Maximum | 100 characters |

The UX should not encourage users to enter private residential addresses.

### Professional Email
| Property | Specification |
|---|---|
| Required | No |
| Type | Email |
| Validation | Valid email format |
| Maximum | 254 characters |
| Visibility | Controlled |

### Phone
| Property | Specification |
|---|---|
| Required | No |
| Type | Telephone |
| Validation | Valid supported phone format |
| Visibility | Controlled |

Use a country selector where international numbers are supported.

### Professional Links
Where supported: Website, LinkedIn, GitHub, and other approved professional links. Each link should support URL validation and visibility rules where applicable.

## 7. User Stories

### US-01 — Create professional identity
**As a** professional user  
**I want to** provide my basic professional identity  
**So that** people can understand who I am.

#### Acceptance Criteria
- User can enter first name.
- User can enter last name.
- User can enter professional headline.
- Required fields are validated.
- Valid information can be saved.
- Saved information appears in the profile header.
- Saved information appears in preview.

### US-02 — Manage profile photo
**As a** professional user  
**I want to** add or update my profile photo  
**So that** my profile has a recognizable visual identity.

#### Acceptance Criteria
- User can upload an image.
- Invalid file types are rejected.
- Upload progress is communicated where necessary.
- User can replace an existing photo.
- User can remove an existing photo.
- A fallback avatar is shown when no photo exists.

### US-03 — Manage professional headline
**As a** professional user  
**I want to** describe what I do professionally  
**So that** visitors understand my professional focus quickly.

#### Acceptance Criteria
- User can enter a headline.
- Maximum length is enforced.
- Character count is visible.
- Validation is displayed appropriately.
- Headline appears in the profile header.
- Headline appears in preview.

### US-04 — Manage professional location
**As a** professional user  
**I want to** specify my professional location  
**So that** people understand where I am professionally based.

#### Acceptance Criteria
- User can enter/select a location.
- Invalid values are handled.
- User can edit the location.
- User can remove the location if optional.
- Location is presented consistently across profile surfaces.

### US-05 — Manage professional contact information
**As a** professional user  
**I want to** provide professional contact details  
**So that** appropriate people can contact me.

#### Acceptance Criteria
- User can add supported contact information.
- Invalid email/phone values are rejected.
- User can edit contact information.
- User can remove optional contact information.
- Visibility rules are respected.

## 8. UX Specification

### Primary layout
Use a strong identity header followed by basic information and professional contact sections.

### UX Flow
Open Professional Profile → determine first-time vs returning user → guided setup or existing profile → edit identity → validate → save → show saved state → update preview.

## 9. Screen Specification

### F01-S01 — Profile Identity

#### Header
**Professional Profile**

Build the professional identity people will see first.

#### Identity card
- Avatar
- Full name
- Professional headline
- Location

#### Form
- First name
- Last name
- Professional headline
- Location

#### Contact section
- Email
- Phone
- Website

#### Footer
- Save status
- Preview profile action

## 10. Profile Photo Interaction

Clicking the avatar opens a photo-management surface with Upload new photo, Remove photo, and Cancel actions.

During upload, communicate progress. After success, show Photo updated.

## 11. Interaction States

Every editable field supports:
- Default
- Hover
- Focus
- Active
- Disabled
- Saving
- Saved
- Error

## 12. Empty State

**Build your professional identity**

Start with the basics. Your name, headline and location help people understand who you are professionally.

**Action:** Get started

## 13. Loading State

Use skeleton loading rather than a blank page or full-page spinner.

## 14. Error State

### Save failure
**Couldn't save your changes.** Your information is still here.

**Action:** Try again

### Photo failure
**We couldn't upload this photo.** Try another image or check your connection.

**Action:** Try again

## 15. Responsive UX

### Desktop
Use a two-column form layout where appropriate.

### Tablet
Maintain two columns where space permits.

### Mobile
Use a single-column layout. Photo actions must remain touch-friendly.

## 16. Accessibility

- Every input has a visible label.
- Placeholder text is not the only label.
- Errors are associated with their fields.
- Focus states are visible.
- Upload controls are keyboard accessible.
- Image uploader has accessible instructions.
- Save status is announced appropriately.
- Touch targets are approximately 44×44 CSS pixels or larger.
- Color is not the only status indicator.

## 17. Assumptions

1. Authentication is handled outside F01.
2. A user has one primary professional profile.
3. Profile identity can be edited after creation.
4. Profile photo is optional.
5. Location represents professional context rather than a residential address.
6. Public/private visibility may be handled by a broader profile/privacy feature.
7. Autosave is the preferred UX, subject to the existing API architecture.
8. Exact image-size limits should be finalized with backend constraints.
9. Social links are included only if supported by the broader Epic 2 scope.

## 18. Feature-Level Acceptance Criteria

- [ ] User can create their professional identity.
- [ ] User can edit identity information.
- [ ] Name validation works.
- [ ] Headline validation works.
- [ ] Location can be managed.
- [ ] Profile photo can be uploaded.
- [ ] Profile photo can be replaced.
- [ ] Profile photo can be removed.
- [ ] Professional contact information can be managed where supported.
- [ ] Changes persist successfully.
- [ ] Save status is visible.
- [ ] Save failures preserve user input.
- [ ] Profile preview reflects identity information.
- [ ] Empty state is designed.
- [ ] Loading state is designed.
- [ ] Error state is designed.
- [ ] Mobile layout is supported.
- [ ] Keyboard accessibility is supported.
- [ ] Screen-reader semantics are supported.

## 19. UX Definition of Done

The feature is UX-complete when the user can go from:

> **I have no professional profile.**

to:

> **This clearly communicates who I am professionally.**

without confusion, unnecessary navigation, accidental data loss, or excessive form complexity.

### F01 Design Principle
> **Identity first. Complexity later.**