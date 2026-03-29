import streamlit as st
import requests

# Page config
st.set_page_config(
    page_title="Candidate Search",
    page_icon="🔍",
    layout="wide"
)

st.title("🔍 Candidate Search System")
st.subheader("Find the best candidates using AI-powered search")

# Search box
query = st.text_input(
    "Search for candidates:",
    placeholder="e.g. Python developer Hyderabad RAG experience"
)

limit = st.slider("Number of results:", 1, 20, 10)

# Search button
if st.button("Search Candidates 🔍"):
    if not query:
        st.warning("Please enter a search query!")
    else:
        with st.spinner("Searching..."):
            try:
                # Call search API
                response = requests.post(
                    "http://127.0.0.1:3001/search_candidates",
                    json={
                        "query": query,
                        "limit": limit
                    }
                )
                data = response.json()

                if data["status"] == "success":
                    st.success(f"Found {data['total']} candidates!")

                    # Show each candidate
                    for i, candidate in enumerate(data["candidates"]):
                        with st.expander(
                            f"#{i+1} Profile ID: {candidate['profile_id']} "
                            f"| Match Score: {candidate['score']*100:.1f}%"
                        ):
                            st.markdown(candidate["summary"])
                else:
                    st.error(f"Error: {data['reason']}")

            except Exception as e:
                st.error(f"Failed to connect to search API: {e}")

# Divider
st.divider()

# Store resume section
st.subheader("📄 Add New Candidate Resume")

col1, col2 = st.columns(2)
with col1:
    profile_id = st.number_input("Profile ID:", min_value=1, value=1)
with col2:
    cv_link = st.text_input("Resume PDF URL:")

if st.button("Process Resume 📤"):
    if not cv_link:
        st.warning("Please enter a resume URL!")
    else:
        with st.spinner("Processing resume..."):
            try:
                response = requests.post(
                    "http://127.0.0.1:3000/process_resume_link_core",
                    json={
                        "profile_id": profile_id,
                        "cv_link": cv_link
                    }
                )
                data = response.json()

                if data["status"] == "success":
                    st.success(f"✅ Resume processed! Profile ID: {data['profile_id']}")
                else:
                    st.error(f"Failed: {data}")

            except Exception as e:
                st.error(f"Failed to connect to storing API: {e}")