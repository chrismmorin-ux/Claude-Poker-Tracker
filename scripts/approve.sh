#!/bin/bash
# scripts/approve.sh

declare -a arr_requests # Declare an empty associative array to store the list of permissions with their IDs as keys 
index=1                 # Initialize index for numbering requests in output display  
echo "Pending Requests:"   
while read line; do     # Read each permission from dispatcher's 'list-permissions' command and parse out request ID. Store it into array along its corresponding number (for user selection)     
  if [[ $line == PR-* ]]; then      
    arr_requests[$index]=$line  
    echo " [$index] ${arr_requests[$index]}"     # Display numbered list of pending requests to the console        
    ((index++))                               # Increment index for next request in array     
  fi                                          # End if statement that checks line starts with 'PR-' (indicating it's a valid permission)  
done < <(node scripts/dispatcher.cjs list-permissions --status=pending 2>/dev/null | grep -oE 'PR-[0-9]{4}-[0-9]{2}-[0-9]{2}-[0-9]+')     # Pipe the output of dispatcher command into while loop and filter out lines starting with PR-   
if [ $index -eq 1 ]; then                     # If index is still at initial value (i.e., no pending requests), display message to user, exit script  
  echo "No Pending Requests"    
  exit                              
fi                                          # End if statement that checks for existence of any permissions in array   
echo ""                                        # Print newline after list output
read -p 'Enter selection (single number, comma-separated list, "all", or Nd to deny): ' num_selection       # Prompt user with input request

# Counter for approved/denied requests
approved_count=0
denied_count=0
failed_count=0

# Check for deny shortcut pattern (e.g., 1d, 2d, etc.)
if [[ $num_selection =~ ^[0-9]+d$ ]]; then
  # Extract the number part (remove the 'd' suffix)
  deny_index=${num_selection%d}

  # Validate the index is within range
  if [ "$deny_index" -ge 1 ] && [ "$deny_index" -lt $index ]; then
    # Get the request ID to deny
    request_to_deny="${arr_requests[$deny_index]}"
    echo "Denying: $request_to_deny"

    # Call dispatcher to reject the permission
    node scripts/dispatcher.cjs reject-permission "$request_to_deny"

    # Check if rejection was successful
    if [ $? -eq 0 ]; then
      echo "Permission $request_to_deny has been denied."
      ((denied_count++))
    else
      echo "Failed to deny permission $request_to_deny"
      ((failed_count++))
    fi
  else
    echo "Invalid selection: $deny_index is out of range"
    exit 1
  fi
elif [[ $num_selection == "all" ]]; then
  # Approve all pending requests
  echo "Approving all pending requests..."

  for ((i = 1; i < index; i++)); do
    request_to_approve="${arr_requests[$i]}"
    echo "Approving: $request_to_approve"

    # Call dispatcher to approve the permission
    node scripts/dispatcher.cjs approve-permission "$request_to_approve"

    # Check if approval was successful
    if [ $? -eq 0 ]; then
      ((approved_count++))
    else
      echo "Failed to approve permission $request_to_approve"
      ((failed_count++))
    fi
  done

  echo ""
  echo "Summary: Approved $approved_count requests"
  if [ $failed_count -gt 0 ]; then
    echo "Failed to approve $failed_count requests"
    exit 1
  fi
elif [[ $num_selection == *","* ]]; then
  # Handle comma-separated list (e.g., 1,2,3)
  echo "Processing batch approval..."

  # Split the input by comma and process each number
  IFS=',' read -ra selections <<< "$num_selection"

  for sel in "${selections[@]}"; do
    # Trim whitespace
    sel=$(echo "$sel" | xargs)

    # Validate the index is within range
    if [ "$sel" -ge 1 ] && [ "$sel" -lt $index ]; then
      request_to_approve="${arr_requests[$sel]}"
      echo "Approving: $request_to_approve"

      # Call dispatcher to approve the permission
      node scripts/dispatcher.cjs approve-permission "$request_to_approve"

      # Check if approval was successful
      if [ $? -eq 0 ]; then
        ((approved_count++))
      else
        echo "Failed to approve permission $request_to_approve"
        ((failed_count++))
      fi
    else
      echo "Invalid selection: $sel is out of range"
      ((failed_count++))
    fi
  done

  echo ""
  echo "Summary: Approved $approved_count requests"
  if [ $failed_count -gt 0 ]; then
    echo "Failed to approve $failed_count requests"
    exit 1
  fi
elif [ $num_selection -ge 1 ] && [ $num_selection -lt $index ]; then     # Check if selected index is within range of array (i.e., valid)
  echo "You have chosen ${arr_requests[$num_selection]}"      # Display the permission corresponding to user's selection

  # Get the request ID to approve
  request_to_approve="${arr_requests[$num_selection]}"

  # Call dispatcher to approve the permission
  node scripts/dispatcher.cjs approve-permission "$request_to_approve"

  # Check if approval was successful
  if [ $? -eq 0 ]; then
    echo "Permission $request_to_approve has been approved."
  else
    echo "Failed to approve permission $request_to_approve"
    exit 1
  fi
else                                                                       # If invalid, display error message and exit script
  echo 'Invalid Selection!'
  exit 1
fi                                          # End if statement that checks validity of selected index
