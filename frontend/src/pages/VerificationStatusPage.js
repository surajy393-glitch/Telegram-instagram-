import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ArrowLeft, CheckCircle2, XCircle, Shield, Info, HelpCircle } from "lucide-react";
import { httpClient } from "@/utils/authClient";


const VerificationStatusPage = ({ user }) => {
  const navigate = useNavigate();
  const [verificationData, setVerificationData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showVerifyDialog, setShowVerifyDialog] = useState(false);
  const [verificationType, setVerificationType] = useState(''); // 'email' or 'phone'
  const [verificationStep, setVerificationStep] = useState('send'); // 'send' or 'verify'
  const [otpCode, setOtpCode] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [email, setEmail] = useState('');
  const [verifying, setVerifying] = useState(false);
  const [message, setMessage] = useState('');
  const [messageType, setMessageType] = useState(''); // 'success' or 'error'
  const [showHelpDialog, setShowHelpDialog] = useState(false);
  const [helpContent, setHelpContent] = useState({ title: '', content: '' });

  useEffect(() => {
    fetchVerificationStatus();
  }, []);

  const fetchVerificationStatus = async () => {
    try {      const response = await httpClient.get(`/verification/status`);
      setVerificationData(response.data);
    } catch (error) {
      console.error("Error fetching verification status:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleVerificationClick = (type) => {
    setVerificationType(type);
    setVerificationStep('send');
    setOtpCode('');
    setMessage('');
    setShowVerifyDialog(true);
  };

  const showHelp = (type) => {
    const helpData = {
      accountAge: {
        title: '⏳ Why 45 Days?',
        content: 'The 45-day waiting period helps us ensure account authenticity and prevents spam. Your account age is calculated from your registration date and cannot be accelerated. This requirement protects our community and maintains the value of verification.'
      },
      avgStoryViews: {
        title: '📊 How Story Views Are Calculated',
        content: 'Average story views = Total views across all your stories ÷ Number of stories posted. Each unique user view counts once per story. Stories expire after 24 hours but their view count is permanently recorded for this calculation.'
      },
      totalLikes: {
        title: '❤️ Total Likes Calculation',
        content: 'Total likes = Sum of all likes received on your posts. Each unique user like counts once per post. This metric shows your overall community engagement and content quality.'
      },
      profileViews: {
        title: '👁️ Profile Views Tracking',
        content: 'Profile views count unique visitors to your profile page. Multiple visits from the same user within 24 hours count as one view. This shows genuine interest in your profile.'
      },
      moderateOr: {
        title: '🎯 Either/Or Condition',
        content: 'For the Moderate Engagement pathway, you need EITHER 500+ total likes OR 40+ average story views. You don\'t need both - achieving just one of these metrics qualifies you. Choose the metric that fits your content style!'
      },
      pathways: {
        title: '🛤️ Multiple Pathways Explained',
        content: 'You only need to complete ONE pathway after meeting basic requirements. Choose the pathway that best matches your activity:\n\n• High Engagement: For very active users\n• Moderate Engagement: For consistent users with longer history\n• Community Contribution: For moderators and contributors (coming soon)\n• Cross-Platform: If you\'re verified elsewhere (coming soon)'
      }
    };
    
    if (helpData[type]) {
      setHelpContent(helpData[type]);
      setShowHelpDialog(true);
    }
  };

  const sendVerificationCode = async () => {
    setVerifying(true);
    setMessage('');
    try {      
      if (verificationType === 'email') {
        const response = await httpClient.post(`/auth/send-email-verification`, { email });
        // For email, show debug code since we're not sending real emails yet
        setMessage(`Code sent! For testing: ${response.data.debug_code}`);
        setMessageType('success');
      } else {
        await httpClient.post(`/auth/send-phone-verification`, { phone: phoneNumber });
        setMessage('Verification code sent to your phone via SMS!');
        setMessageType('success');
      }
      setVerificationStep('verify');
    } catch (error) {
      setMessage(error.response?.data?.detail || 'Failed to send verification code');
      setMessageType('error');
    } finally {
      setVerifying(false);
    }
  };

  const verifyCode = async () => {
    setVerifying(true);
    setMessage('');
    try {      
      if (verificationType === 'email') {
        await httpClient.post(`/auth/verify-email-code`, { code: otpCode });
        setMessage('Email verified successfully!');
      } else {
        await httpClient.post(`/auth/verify-phone-code`, { code: otpCode });
        setMessage('Phone verified successfully!');
      }
      setMessageType('success');
      
      // Refresh verification status
      setTimeout(() => {
        setShowVerifyDialog(false);
        fetchVerificationStatus();
      }, 1500);
    } catch (error) {
      setMessage(error.response?.data?.detail || 'Invalid verification code');
      setMessageType('error');
    } finally {
      setVerifying(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-blue-50 to-white">
        <div className="text-2xl text-blue-600">Loading...</div>
      </div>
    );
  }

  // Group criteria by category
  const identitySecurityCriteria = [
    {
      key: 'emailVerified',
      label: 'Email Verified',
      requirement: 'Verify your email address',
      met: verificationData?.criteria?.emailVerified || false,
      progress: verificationData?.currentValues?.emailVerified ? 'Verified' : 'Not verified'
    },
    {
      key: 'mobileVerified',
      label: 'Phone Verified',
      requirement: 'Verify your phone number',
      met: verificationData?.criteria?.mobileVerified || false,
      progress: verificationData?.currentValues?.mobileVerified ? 'Verified' : 'Not verified'
    }
  ];

  const profileCompletenessCriteria = [
    {
      key: 'profileComplete',
      label: 'Complete Profile',
      requirement: 'Fill all profile fields',
      met: verificationData?.criteria?.profileComplete || false,
      progress: verificationData?.currentValues?.profileComplete ? 'Complete' : 'Incomplete'
    },
    {
      key: 'personalityQuestions',
      label: 'Personality Quiz',
      requirement: 'Complete personality questions',
      met: true,
      progress: 'Completed'
    }
  ];

  const tenureBehaviourCriteria = [
    {
      key: 'accountAge',
      label: 'Account Age',
      requirement: '45+ days old',
      met: verificationData?.criteria?.accountAge || false,
      progress: `${verificationData?.currentValues?.accountAgeDays || 0} days`,
      hasHelp: true,
      helpKey: 'accountAge'
    },
    {
      key: 'noViolations',
      label: 'No Violations',
      requirement: 'Zero community violations',
      met: verificationData?.criteria?.noViolations || false,
      progress: `${verificationData?.currentValues?.violationsCount || 0} violations`
    }
  ];

  // Pathways
  const pathways = [
    {
      id: 'highEngagement',
      name: '🔥 High Engagement Pathway',
      description: 'For active community members with strong presence',
      met: verificationData?.pathways?.highEngagement || false,
      requirements: [
        { label: '20+ Posts', met: verificationData?.criteria?.postsCount, value: `${verificationData?.currentValues?.postsCount || 0}/20` },
        { label: '100+ Followers', met: verificationData?.criteria?.followersCount, value: `${verificationData?.currentValues?.followersCount || 0}/100` },
        { label: '1000+ Total Likes', met: verificationData?.criteria?.totalLikes, value: `${verificationData?.currentValues?.totalLikes || 0}/1000`, hasHelp: true, helpKey: 'totalLikes' },
        { label: '70+ Avg Story Views', met: verificationData?.criteria?.avgStoryViews, value: `${verificationData?.currentValues?.avgStoryViews || 0}/70`, hasHelp: true, helpKey: 'avgStoryViews' },
        { label: '1000+ Profile Views', met: verificationData?.criteria?.profileViews, value: `${verificationData?.currentValues?.profileViews || 0}/1000`, hasHelp: true, helpKey: 'profileViews' }
      ]
    },
    {
      id: 'moderateEngagement',
      name: '⭐ Moderate Engagement Pathway',
      description: 'Lower thresholds for consistent users (90+ day accounts)',
      met: verificationData?.pathways?.moderateEngagement || false,
      requirements: [
        { label: '10+ Posts', met: verificationData?.currentValues?.moderateEngagementPosts, value: `${verificationData?.currentValues?.postsCount || 0}/10` },
        { label: '50+ Followers', met: verificationData?.currentValues?.moderateEngagementFollowers, value: `${verificationData?.currentValues?.followersCount || 0}/50` },
        { label: '90+ Days Old', met: verificationData?.currentValues?.moderateEngagementTenure, value: `${verificationData?.currentValues?.accountAgeDays || 0}/90 days` },
        { 
          label: '500+ Likes OR 40+ Avg Story Views (either one)', 
          met: verificationData?.currentValues?.moderateEngagementLikes, 
          value: `Likes: ${verificationData?.currentValues?.totalLikes || 0}/500 | Views: ${verificationData?.currentValues?.avgStoryViews || 0}/40`,
          isOr: true,
          hasHelp: true,
          helpKey: 'moderateOr'
        }
      ]
    },
    {
      id: 'communityContribution',
      name: '🏆 Community Contribution',
      description: 'For moderators, event organizers, and active contributors',
      met: verificationData?.pathways?.communityContribution || false,
      comingSoon: true,
      futureDetails: 'Qualify by: Moderating groups for 4+ weeks • Hosting 2+ successful events • 50+ helpful reports with staff approval',
      requirements: [
        { label: 'Coming Soon - Apply via moderator program', met: false, value: 'Not yet available' }
      ]
    },
    {
      id: 'crossPlatform',
      name: '🔗 Cross-Platform Verified',
      description: 'Already verified on Instagram, Twitter, or LinkedIn',
      met: verificationData?.pathways?.crossPlatformVerified || false,
      comingSoon: true,
      futureDetails: 'Accepted platforms: Instagram, Twitter/X, LinkedIn, Facebook • You must post a verification code on that platform to prove ownership',
      requirements: [
        { label: 'Coming Soon - Link verified social account', met: false, value: 'Not yet available' }
      ]
    }
  ];

  const allGroups = [
    { title: '1. Identity & Security', criteria: identitySecurityCriteria, required: true },
    { title: '2. Profile Completeness', criteria: profileCompletenessCriteria, required: true },
    { title: '3. Tenure & Behaviour', criteria: tenureBehaviourCriteria, required: true }
  ];

  const basicRequirementsMet = identitySecurityCriteria.every(c => c.met) && 
                                profileCompletenessCriteria.every(c => c.met) &&
                                tenureBehaviourCriteria.every(c => c.met);

  // Calculate smart guidance - show user their easiest path
  const getSmartGuidance = () => {
    if (verificationData?.isVerified) return null;
    
    const basicMissing = [];
    if (!verificationData?.criteria?.emailVerified) basicMissing.push('Verify your email');
    if (!verificationData?.criteria?.mobileVerified) basicMissing.push('Verify your phone');
    if (!verificationData?.criteria?.profileComplete) basicMissing.push('Complete your profile');
    if (!verificationData?.criteria?.accountAge) {
      const daysLeft = 45 - (verificationData?.currentValues?.accountAgeDays || 0);
      basicMissing.push(`Wait ${daysLeft} more days (account age)`);
    }
    if (!verificationData?.criteria?.noViolations) basicMissing.push('Clear violations');
    
    if (basicMissing.length > 0) {
      return {
        type: 'basic',
        message: `Complete basic requirements first: ${basicMissing.join(', ')}`,
        color: 'blue'
      };
    }
    
    // Calculate distance to each pathway
    const pathwayDistances = [];
    
    // High Engagement
    const highEngagementGaps = [];
    if ((verificationData?.currentValues?.postsCount || 0) < 20) 
      highEngagementGaps.push(`${20 - (verificationData?.currentValues?.postsCount || 0)} more posts`);
    if ((verificationData?.currentValues?.followersCount || 0) < 100) 
      highEngagementGaps.push(`${100 - (verificationData?.currentValues?.followersCount || 0)} more followers`);
    if ((verificationData?.currentValues?.totalLikes || 0) < 1000) 
      highEngagementGaps.push(`${1000 - (verificationData?.currentValues?.totalLikes || 0)} more likes`);
    if ((verificationData?.currentValues?.avgStoryViews || 0) < 70) 
      highEngagementGaps.push(`${70 - (verificationData?.currentValues?.avgStoryViews || 0)} more avg story views`);
    if ((verificationData?.currentValues?.profileViews || 0) < 1000) 
      highEngagementGaps.push(`${1000 - (verificationData?.currentValues?.profileViews || 0)} more profile views`);
    
    if (highEngagementGaps.length > 0) {
      pathwayDistances.push({
        name: 'High Engagement',
        gaps: highEngagementGaps,
        distance: highEngagementGaps.length
      });
    }
    
    // Moderate Engagement
    const moderateEngagementGaps = [];
    if ((verificationData?.currentValues?.postsCount || 0) < 10) 
      moderateEngagementGaps.push(`${10 - (verificationData?.currentValues?.postsCount || 0)} more posts`);
    if ((verificationData?.currentValues?.followersCount || 0) < 50) 
      moderateEngagementGaps.push(`${50 - (verificationData?.currentValues?.followersCount || 0)} more followers`);
    if ((verificationData?.currentValues?.accountAgeDays || 0) < 90) 
      moderateEngagementGaps.push(`wait ${90 - (verificationData?.currentValues?.accountAgeDays || 0)} more days`);
    
    const hasLikes = (verificationData?.currentValues?.totalLikes || 0) >= 500;
    const hasStoryViews = (verificationData?.currentValues?.avgStoryViews || 0) >= 40;
    if (!hasLikes && !hasStoryViews) {
      const likesNeeded = 500 - (verificationData?.currentValues?.totalLikes || 0);
      const viewsNeeded = 40 - (verificationData?.currentValues?.avgStoryViews || 0);
      moderateEngagementGaps.push(`${Math.min(likesNeeded, viewsNeeded)} more ${likesNeeded < viewsNeeded ? 'likes' : 'story views'}`);
    }
    
    if (moderateEngagementGaps.length > 0) {
      pathwayDistances.push({
        name: 'Moderate Engagement',
        gaps: moderateEngagementGaps,
        distance: moderateEngagementGaps.length
      });
    }
    
    // Find closest pathway
    if (pathwayDistances.length > 0) {
      const closest = pathwayDistances.sort((a, b) => a.distance - b.distance)[0];
      return {
        type: 'pathway',
        message: `Closest to ${closest.name} pathway! You need: ${closest.gaps.slice(0, 2).join(', ')}${closest.gaps.length > 2 ? ` +${closest.gaps.length - 2} more` : ''}`,
        color: 'green'
      };
    }
    
    return null;
  };

  const smartGuidance = getSmartGuidance();

  // Calculate overall progress
  const basicCount = [...identitySecurityCriteria, ...profileCompletenessCriteria, ...tenureBehaviourCriteria].filter(c => c.met).length;
  const basicTotal = identitySecurityCriteria.length + profileCompletenessCriteria.length + tenureBehaviourCriteria.length;
  const overallProgress = verificationData?.isVerified ? 100 : Math.round((basicCount / basicTotal) * 100);

  // Flatten all criteria for display
  const criteria = [...identitySecurityCriteria, ...profileCompletenessCriteria, ...tenureBehaviourCriteria];
  const metCriteria = criteria.filter(c => c.met).length;
  const totalCriteria = criteria.length;

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-blue-100">
      {/* Header */}
      <header className="glass-effect border-b border-blue-100 sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4 flex items-center">
          <Button 
            variant="ghost" 
            className="hover:bg-blue-50 mr-3"
            onClick={() => navigate(-1)}
          >
            <ArrowLeft className="w-5 h-5 text-blue-600" />
          </Button>
          <h1 className="text-2xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-cyan-500">
            LuvHive Verified
          </h1>
        </div>
      </header>

      <div className="container mx-auto px-4 py-8 max-w-2xl">
        {/* Verification Status Card */}
        <div className={`glass-effect rounded-3xl p-8 mb-6 shadow-xl animate-fadeIn ${verificationData?.isVerified ? 'bg-gradient-to-br from-green-50 to-blue-50' : ''}`}>
          <div className="text-center mb-6">
            <div className={`inline-flex items-center justify-center w-24 h-24 rounded-full mb-4 ${verificationData?.isVerified ? 'bg-gradient-to-br from-green-500 to-blue-500' : 'bg-gradient-to-br from-blue-500 to-cyan-500'}`}>
              {verificationData?.isVerified ? (
                <CheckCircle2 className="w-12 h-12 text-white" />
              ) : (
                <Shield className="w-12 h-12 text-white" />
              )}
            </div>
            <h2 className="text-3xl font-bold text-gray-800 mb-2">
              {verificationData?.isVerified ? '🎉 You\'re Verified!' : 'Verification Progress'}
            </h2>
            <p className="text-lg text-gray-600 mb-4">
              {verificationData?.isVerified 
                ? 'Your account has been verified with the blue checkmark ☑️'
                : `${basicCount}/${basicTotal} basic requirements • ${pathways.filter(p => p.met).length}/4 pathways`}
            </p>
          </div>

          {/* Smart Guidance */}
          {smartGuidance && (
            <div className={`${
              smartGuidance.color === 'blue' ? 'bg-blue-100 text-blue-800 border-blue-300' : 'bg-green-100 text-green-800 border-green-300'
            } border-2 rounded-xl p-4 mb-4`}>
              <p className="text-sm font-medium flex items-center gap-2">
                <span className="text-lg">{smartGuidance.color === 'blue' ? '🎯' : '🚀'}</span>
                {smartGuidance.message}
              </p>
            </div>
          )}

          {/* Progress Bar */}
          <div className="bg-gray-200 rounded-full h-4 overflow-hidden mb-2">
            <div 
              className={`h-full transition-all duration-500 ease-out ${verificationData?.isVerified ? 'bg-gradient-to-r from-green-500 to-blue-500' : 'bg-gradient-to-r from-blue-500 to-cyan-500'}`}
              style={{ width: `${overallProgress}%` }}
            />
          </div>
          <p className="text-right text-sm text-gray-600 font-semibold">{overallProgress}% Complete</p>
        </div>

        {/* Show grouped criteria if not verified yet */}
        {!verificationData?.isVerified && (
        <>
          {/* Basic Requirements */}
          <div className="glass-effect rounded-3xl p-6 shadow-xl mb-6">
            <h3 className="text-xl font-bold text-gray-800 mb-2">Basic Requirements</h3>
            <p className="text-sm text-gray-600 mb-4">Complete all sections below to qualify for verification</p>
            
            {allGroups.map((group, groupIdx) => (
              <div key={groupIdx} className="mb-6 last:mb-0">
                <h4 className="text-lg font-semibold text-gray-700 mb-3 flex items-center gap-2">
                  {group.title}
                  {group.criteria.every(c => c.met) && <CheckCircle2 className="w-5 h-5 text-green-600" />}
                </h4>
                <div className="space-y-3">
                  {group.criteria.map((criterion) => {
                    const isVerifiable = (criterion.key === 'emailVerified' || criterion.key === 'mobileVerified') && !criterion.met;
                    
                    return (
                      <div 
                        key={criterion.key}
                        className={`p-4 rounded-xl border-2 transition-all ${
                          criterion.met 
                            ? 'bg-green-50 border-green-300' 
                            : isVerifiable 
                            ? 'bg-blue-50 border-blue-300 cursor-pointer hover:border-blue-400 hover:shadow-md' 
                            : 'bg-gray-50 border-gray-200'
                        }`}
                        onClick={() => isVerifiable && handleVerificationClick(criterion.key === 'emailVerified' ? 'email' : 'phone')}
                      >
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-1">
                              {criterion.met ? (
                                <CheckCircle2 className="w-5 h-5 text-green-600" />
                              ) : (
                                <XCircle className="w-5 h-5 text-gray-400" />
                              )}
                              <h4 className="font-semibold text-gray-800">{criterion.label}</h4>
                              {criterion.hasHelp && (
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    showHelp(criterion.helpKey);
                                  }}
                                  className="text-blue-500 hover:text-blue-700"
                                >
                                  <HelpCircle className="w-4 h-4" />
                                </button>
                              )}
                              {isVerifiable && (
                                <span className="text-xs bg-blue-500 text-white px-2 py-1 rounded-full ml-2">
                                  Click to Verify
                                </span>
                              )}
                            </div>
                            <p className="text-sm text-gray-600 ml-7">{criterion.requirement}</p>
                          </div>
                          <div className="text-right">
                            <p className={`text-sm font-medium ${
                              criterion.met ? 'text-green-600' : 'text-gray-500'
                            }`}>
                              {criterion.progress}
                            </p>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>

          {/* Verification Pathways */}
          <div className="glass-effect rounded-3xl p-6 shadow-xl mb-6">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-xl font-bold text-gray-800">Choose Your Pathway to Verification</h3>
              <button
                onClick={() => showHelp('pathways')}
                className="text-blue-500 hover:text-blue-700"
              >
                <HelpCircle className="w-5 h-5" />
              </button>
            </div>
            <p className="text-sm text-gray-600 mb-4">
              {basicRequirementsMet 
                ? "✅ Basic requirements met! Complete ANY ONE pathway below to qualify for verification."
                : "⚠️ Complete basic requirements first, then choose one pathway to pursue."}
            </p>

            <div className="space-y-4">
              {pathways.map((pathway) => (
                <div 
                  key={pathway.id}
                  className={`p-5 rounded-xl border-2 transition-all ${
                    pathway.met 
                      ? 'bg-gradient-to-br from-green-50 to-green-100 border-green-400 shadow-lg' 
                      : pathway.comingSoon
                      ? 'bg-gradient-to-br from-gray-50 to-gray-100 border-gray-300'
                      : 'bg-white border-gray-200'
                  }`}
                >
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex-1">
                      <h4 className="text-lg font-bold text-gray-800 mb-1 flex items-center gap-2">
                        {pathway.name}
                        {pathway.met && <CheckCircle2 className="w-6 h-6 text-green-600" />}
                        {pathway.comingSoon && <span className="text-xs bg-gray-400 text-white px-2 py-1 rounded-full ml-2">Coming Soon</span>}
                      </h4>
                      <p className="text-sm text-gray-600">{pathway.description}</p>
                      {pathway.futureDetails && (
                        <p className="text-xs text-gray-500 mt-2 italic">
                          📋 {pathway.futureDetails}
                        </p>
                      )}
                    </div>
                  </div>
                  
                  <div className="space-y-2 mt-3">
                    {pathway.requirements.map((req, idx) => (
                      <div key={idx} className={`flex items-center justify-between text-sm ${req.isOr ? 'bg-yellow-50 p-2 rounded-lg border border-yellow-200' : ''}`}>
                        <div className="flex items-center gap-2 flex-1">
                          {req.met ? (
                            <CheckCircle2 className="w-4 h-4 text-green-600 flex-shrink-0" />
                          ) : (
                            <XCircle className="w-4 h-4 text-gray-400 flex-shrink-0" />
                          )}
                          <span className={`${req.met ? 'text-green-700 font-medium' : 'text-gray-600'} ${req.isOr ? 'font-semibold' : ''}`}>
                            {req.label}
                          </span>
                          {req.hasHelp && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                showHelp(req.helpKey);
                              }}
                              className="text-blue-500 hover:text-blue-700 ml-1"
                            >
                              <HelpCircle className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                        <span className="text-xs text-gray-500 ml-2">{req.value}</span>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </>
        )}

        {/* Success message for verified users */}
        {verificationData?.isVerified && (
        <div className="glass-effect rounded-3xl p-6 shadow-xl bg-gradient-to-br from-green-50 to-blue-50">
          <h3 className="text-xl font-bold text-gray-800 mb-3">🎉 Congratulations!</h3>
          <p className="text-gray-700 leading-relaxed mb-2">
            You are now a verified member of LuvHive! Your blue checkmark badge appears next to your username across the platform, helping others know your account is authentic.
          </p>
          
          {verificationData?.verificationPathway && (
            <div className="bg-blue-100 border border-blue-300 rounded-lg p-3 mb-4">
              <p className="text-sm font-semibold text-blue-800">
                ✨ Verified via: {verificationData.verificationPathway}
              </p>
              {verificationData?.verifiedAt && (
                <p className="text-xs text-blue-700 mt-1">
                  Verified on: {new Date(verificationData.verifiedAt).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}
                </p>
              )}
            </div>
          )}
          
          <div className="bg-white bg-opacity-60 rounded-xl p-4 mb-4">
            <h4 className="font-semibold text-gray-800 mb-2">✨ Verified Badge Benefits:</h4>
            <ul className="space-y-2 text-sm text-gray-700">
              <li>• Blue checkmark ☑️ on your profile</li>
              <li>• Badge appears on all your posts</li>
              <li>• Badge visible in story viewer</li>
              <li>• Enhanced credibility and trust</li>
              <li>• Stand out in search results</li>
            </ul>
          </div>
          
          <Button
            onClick={() => {
              const text = `Just got verified on LuvHive! ✨ Achieved verification via the ${verificationData?.verificationPathway || 'verification program'}. 💙 #LuvHiveVerified`;
              if (navigator.share) {
                navigator.share({ text });
              } else {
                navigator.clipboard.writeText(text);
                alert('Verification achievement copied to clipboard!');
              }
            }}
            className="w-full bg-gradient-to-r from-blue-500 to-cyan-500 hover:from-blue-600 hover:to-cyan-600 text-white"
          >
            🎊 Share Your Achievement
          </Button>
        </div>
        )}

        {/* Info Box - only for non-verified */}
        {!verificationData?.isVerified && (
        <div className="glass-effect rounded-3xl p-6 mt-6 shadow-xl bg-blue-50">
          <h3 className="text-lg font-bold text-gray-800 mb-2">💡 Multiple Ways to Get Verified</h3>
          <p className="text-sm text-gray-600 leading-relaxed mb-3">
            We believe in recognizing value in different forms. You don't need millions of followers to get verified!
          </p>
          <ul className="text-sm text-gray-700 space-y-2">
            <li className="flex items-start gap-2">
              <span className="text-blue-600 font-bold">•</span>
              <span><strong>High Engagement:</strong> For active members with strong community presence</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-blue-600 font-bold">•</span>
              <span><strong>Moderate Engagement:</strong> Lower thresholds for accounts with longer history (90+ days)</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-blue-600 font-bold">•</span>
              <span><strong>Community Contribution:</strong> Coming soon - for moderators and active contributors</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-blue-600 font-bold">•</span>
              <span><strong>Cross-Platform:</strong> Coming soon - link your verified social media accounts</span>
            </li>
          </ul>
        </div>
        )}
      </div>

      {/* Verification Dialog */}
      <Dialog open={showVerifyDialog} onOpenChange={setShowVerifyDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              Verify Your {verificationType === 'email' ? 'Email' : 'Phone Number'}
            </DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            {verificationStep === 'send' ? (
              <>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-gray-700">
                    {verificationType === 'email' ? 'Email Address' : 'Phone Number'}
                  </label>
                  {verificationType === 'email' ? (
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="Enter your email"
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  ) : (
                    <input
                      type="tel"
                      value={phoneNumber}
                      onChange={(e) => setPhoneNumber(e.target.value)}
                      placeholder="Enter your phone number"
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  )}
                </div>
                
                <Button 
                  onClick={sendVerificationCode}
                  disabled={verifying || (verificationType === 'email' ? !email : !phoneNumber)}
                  className="w-full bg-blue-500 hover:bg-blue-600 text-white"
                >
                  {verifying ? 'Sending...' : 'Send Verification Code'}
                </Button>
              </>
            ) : (
              <>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-gray-700">
                    Enter Verification Code
                  </label>
                  <input
                    type="text"
                    value={otpCode}
                    onChange={(e) => setOtpCode(e.target.value)}
                    placeholder="Enter 6-digit code"
                    maxLength={6}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-center text-2xl tracking-widest"
                  />
                </div>
                
                <Button 
                  onClick={verifyCode}
                  disabled={verifying || otpCode.length !== 6}
                  className="w-full bg-green-500 hover:bg-green-600 text-white"
                >
                  {verifying ? 'Verifying...' : 'Verify Code'}
                </Button>
                
                <button
                  onClick={() => setVerificationStep('send')}
                  className="w-full text-sm text-blue-600 hover:underline"
                >
                  Didn't receive code? Send again
                </button>
              </>
            )}
            
            {message && (
              <div className={`p-3 rounded-lg ${
                messageType === 'success' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'
              }`}>
                {message}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Help Dialog */}
      <Dialog open={showHelpDialog} onOpenChange={setShowHelpDialog}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-xl">{helpContent.title}</DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <p className="text-gray-700 leading-relaxed whitespace-pre-line">
              {helpContent.content}
            </p>
          </div>
          <Button 
            onClick={() => setShowHelpDialog(false)}
            className="w-full bg-blue-500 hover:bg-blue-600 text-white"
          >
            Got it!
          </Button>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default VerificationStatusPage;
